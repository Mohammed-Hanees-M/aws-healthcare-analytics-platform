"""
AWS Lambda Function: ML Anomaly Detector
Uses trained Isolation Forest model to flag abnormal patient vitals.
Deployed via Elastic Beanstalk / Lambda — triggered by API Gateway or SNS.
"""

import json
import os
import boto3
import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from datetime import datetime, timedelta
import logging
import uuid
import pickle
import io

# ── Scikit-learn (bundled in deployment package) ──────────────────────────────
try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

MODEL_BUCKET = os.environ.get('S3_BUCKET_NAME', 'healthcare-data-bucket')
MODEL_KEY = 'models/isolation_forest_v1.pkl'
SCALER_KEY = 'models/scaler_v1.pkl'

# Vital sign thresholds for rule-based fallback
THRESHOLDS = {
    'heart_rate':         {'min': 40,  'max': 150, 'critical_min': 30,  'critical_max': 180},
    'systolic_bp':        {'min': 80,  'max': 160, 'critical_min': 70,  'critical_max': 200},
    'diastolic_bp':       {'min': 50,  'max': 100, 'critical_min': 40,  'critical_max': 120},
    'oxygen_saturation':  {'min': 92,  'max': 100, 'critical_min': 88,  'critical_max': 100},
    'temperature':        {'min': 35.5,'max': 38.5,'critical_min': 34.0,'critical_max': 41.0},
    'respiratory_rate':   {'min': 10,  'max': 24,  'critical_min': 8,   'critical_max': 35},
    'glucose_level':      {'min': 60,  'max': 250, 'critical_min': 40,  'critical_max': 400},
}

VITAL_FEATURES = [
    'heart_rate', 'systolic_bp', 'diastolic_bp',
    'oxygen_saturation', 'temperature',
    'respiratory_rate', 'glucose_level'
]


def get_db_connection():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL must be set in environment")
    return psycopg2.connect(db_url)


def load_model_from_s3():
    """Load pre-trained model from S3. Falls back to in-memory training."""
    try:
        model_obj = s3_client.get_object(Bucket=MODEL_BUCKET, Key=MODEL_KEY)
        scaler_obj = s3_client.get_object(Bucket=MODEL_BUCKET, Key=SCALER_KEY)
        model = pickle.loads(model_obj['Body'].read())
        scaler = pickle.loads(scaler_obj['Body'].read())
        logger.info("✅ Loaded model from S3")
        return model, scaler
    except Exception as e:
        logger.warning(f"Could not load model from S3: {e}. Training fresh model.")
        return None, None


def train_model(conn) -> tuple:
    """Train Isolation Forest on recent vital records from RDS."""
    if not SKLEARN_AVAILABLE:
        return None, None

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT heart_rate, systolic_bp, diastolic_bp,
               oxygen_saturation, temperature, respiratory_rate, glucose_level
        FROM vital_records
        WHERE recorded_at > NOW() - INTERVAL '30 days'
          AND heart_rate IS NOT NULL
          AND oxygen_saturation IS NOT NULL
        LIMIT 5000
    """)
    rows = cursor.fetchall()
    cursor.close()

    if len(rows) < 50:
        logger.warning("Not enough data to train model (<50 records)")
        return None, None

    X = np.array([[
        row['heart_rate'] or 75,
        row['systolic_bp'] or 120,
        row['diastolic_bp'] or 80,
        row['oxygen_saturation'] or 98,
        row['temperature'] or 36.8,
        row['respiratory_rate'] or 16,
        row['glucose_level'] or 100
    ] for row in rows])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,   # expect ~5% anomalies
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_scaled)
    logger.info(f"✅ Trained Isolation Forest on {len(rows)} records")
    return model, scaler


def rule_based_severity(vitals: dict) -> tuple:
    """Fallback: rule-based threshold anomaly detection."""
    anomalies_found = []
    max_severity = 'low'
    severity_rank = {'low': 0, 'medium': 1, 'high': 2, 'critical': 3}

    for vital, thresh in THRESHOLDS.items():
        val = vitals.get(vital)
        if val is None:
            continue
        if val <= thresh['critical_min'] or val >= thresh['critical_max']:
            anomalies_found.append((vital, 'critical'))
            if severity_rank['critical'] > severity_rank.get(max_severity, 0):
                max_severity = 'critical'
        elif val <= thresh['min'] or val >= thresh['max']:
            anomalies_found.append((vital, 'high'))
            if severity_rank['high'] > severity_rank.get(max_severity, 0):
                max_severity = 'high'

    if len(anomalies_found) >= 3:
        return True, 'critical', 0.95, 'multi_vital_anomaly'
    elif anomalies_found:
        vital_name, sev = anomalies_found[0]
        anomaly_type = f"{vital_name}_critical"
        return True, sev, 0.8, anomaly_type
    return False, 'low', 0.1, None


def score_vital_record(record: dict, model, scaler) -> tuple:
    """Score a single vital record using ML model or rule-based fallback."""
    vitals = {f: record.get(f) for f in VITAL_FEATURES}

    # ML scoring
    if model and scaler and all(vitals.get(f) is not None for f in VITAL_FEATURES):
        X = np.array([[vitals[f] for f in VITAL_FEATURES]])
        X_scaled = scaler.transform(X)
        prediction = model.predict(X_scaled)[0]          # -1 = anomaly
        score = -model.score_samples(X_scaled)[0]        # higher = more anomalous
        score = float(np.clip(score, 0, 1))

        if prediction == -1:
            is_anomaly, severity, _, anomaly_type = rule_based_severity(vitals)
            # Override severity based on ML score
            if score > 0.85:
                severity = 'critical'
            elif score > 0.7:
                severity = 'high'
            elif score > 0.5:
                severity = 'medium'
            else:
                severity = 'low'
            anomaly_type = anomaly_type or 'multi_vital_anomaly'
            return True, severity, score, anomaly_type
        return False, 'low', score, None

    # Fallback: rule-based
    return rule_based_severity(vitals)


def get_unscored_vitals(conn, hours_back: int = 1) -> list:
    """Fetch vital records not yet scored for anomalies."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT vr.id, vr.patient_id, vr.heart_rate, vr.systolic_bp, vr.diastolic_bp,
               vr.oxygen_saturation, vr.temperature, vr.respiratory_rate,
               vr.glucose_level, vr.recorded_at
        FROM vital_records vr
        WHERE vr.recorded_at > NOW() - INTERVAL '%s hours'
          AND vr.is_anomaly = FALSE
          AND vr.anomaly_score < 0.3
        ORDER BY vr.recorded_at DESC
        LIMIT 500
    """, (hours_back,))
    records = cursor.fetchall()
    cursor.close()
    return [dict(r) for r in records]


def save_anomalies(conn, anomalies: list):
    """Bulk insert detected anomalies into RDS."""
    if not anomalies:
        return
    cursor = conn.cursor()
    values = [(
        str(uuid.uuid4()),
        a['patient_id'],
        a['vital_record_id'],
        a['anomaly_type'],
        a['severity'],
        a['score'],
        a['description'],
        json.dumps(a['vital_values']),
        '1.0.0',
        False,
        datetime.now(),
        datetime.now()
    ) for a in anomalies]

    execute_values(cursor, """
        INSERT INTO anomalies
          (id, patient_id, vital_record_id, anomaly_type, severity, score,
           description, vital_values, ml_model_version, is_acknowledged,
           created_at, updated_at)
        VALUES %s
        ON CONFLICT DO NOTHING
    """, values)

    # Update vital_records with anomaly flag
    for a in anomalies:
        cursor.execute("""
            UPDATE vital_records
            SET is_anomaly = TRUE, anomaly_score = %s
            WHERE id = %s
        """, (a['score'], a['vital_record_id']))

    conn.commit()
    cursor.close()
    logger.info(f"Saved {len(anomalies)} anomalies to RDS")


def lambda_handler(event, context):
    """Main Lambda handler for anomaly detection."""
    logger.info(f"Anomaly Detector triggered: {json.dumps(event)}")

    hours_back = event.get('hours_back', 1)
    force_retrain = event.get('retrain', False)

    results = {
        'status': 'success',
        'scanned_records': 0,
        'anomalies_detected': 0,
        'model_source': 'unknown',
        'timestamp': datetime.now().isoformat()
    }

    try:
        conn = get_db_connection()
        logger.info("✅ Connected to RDS")

        # Load or train model
        model, scaler = None, None
        if not force_retrain:
            model, scaler = load_model_from_s3()
            if model:
                results['model_source'] = 's3'

        if model is None and SKLEARN_AVAILABLE:
            model, scaler = train_model(conn)
            results['model_source'] = 'freshly_trained'
        elif model is None:
            results['model_source'] = 'rule_based'

        # Fetch and score vital records
        vitals = get_unscored_vitals(conn, hours_back)
        results['scanned_records'] = len(vitals)
        logger.info(f"Scoring {len(vitals)} vital records...")

        detected_anomalies = []
        for record in vitals:
            is_anomaly, severity, score, anomaly_type = score_vital_record(record, model, scaler)
            if is_anomaly:
                detected_anomalies.append({
                    'patient_id': record['patient_id'],
                    'vital_record_id': record['id'],
                    'anomaly_type': anomaly_type or 'multi_vital_anomaly',
                    'severity': severity,
                    'score': score,
                    'description': f"ML anomaly detected (score={score:.3f}). Abnormal vital signs require clinical review.",
                    'vital_values': {
                        'hr': record.get('heart_rate'),
                        'bp': f"{record.get('systolic_bp','?')}/{record.get('diastolic_bp','?')}",
                        'spo2': record.get('oxygen_saturation'),
                        'temp': record.get('temperature'),
                        'rr': record.get('respiratory_rate'),
                        'glucose': record.get('glucose_level')
                    }
                })

        save_anomalies(conn, detected_anomalies)
        results['anomalies_detected'] = len(detected_anomalies)

        conn.close()
        logger.info(f"✅ Anomaly detection complete: {results}")
        return {'statusCode': 200, 'body': json.dumps(results)}

    except Exception as e:
        logger.error(f"Anomaly detector error: {e}", exc_info=True)
        return {'statusCode': 500, 'body': json.dumps({'status': 'error', 'message': str(e)})}
