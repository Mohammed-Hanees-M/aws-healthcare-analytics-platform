"""
AWS Lambda Function: ETL Pipeline
Triggered by S3 ObjectCreated events or API Gateway
Ingests CSV healthcare datasets → PostgreSQL RDS
"""

import json
import os
import boto3
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
import logging
import uuid

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ─── Database Connection ──────────────────────────────────────────────────────
def get_db_connection():
    return psycopg2.connect(
        host=os.environ['DB_HOST'],
        port=os.environ.get('DB_PORT', 5432),
        dbname=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        sslmode='require' if os.environ.get('NODE_ENV') == 'production' else 'prefer'
    )

# ─── S3 Client ────────────────────────────────────────────────────────────────
s3_client = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-east-1'))


def read_csv_from_s3(bucket: str, key: str) -> pd.DataFrame:
    """Read CSV file from S3 bucket into DataFrame."""
    logger.info(f"Reading s3://{bucket}/{key}")
    response = s3_client.get_object(Bucket=bucket, Key=key)
    df = pd.read_csv(response['Body'])
    logger.info(f"Loaded {len(df)} rows, columns: {list(df.columns)}")
    return df


def detect_dataset_type(df: pd.DataFrame) -> str:
    """Auto-detect Kaggle dataset type from column names."""
    cols = set(df.columns.str.lower())
    if 'thalach' in cols or 'thal' in cols:
        return 'heart_disease'
    elif 'hba1c_level' in cols or 'readmitted' in cols or 'diabetesMed' in cols.union(df.columns):
        return 'diabetes'
    elif 'heart_rate' in cols or 'spo2' in cols:
        return 'vitals'
    return 'unknown'


def transform_heart_disease(df: pd.DataFrame) -> list:
    """Transform UCI Heart Disease dataset to patient records."""
    logger.info("Transforming Heart Disease dataset...")
    patients = []
    for _, row in df.iterrows():
        age = int(row.get('age', 50))
        patients.append({
            'id': str(uuid.uuid4()),
            'patient_id': f"HD{str(uuid.uuid4())[:8].upper()}",
            'first_name': 'Patient',
            'last_name': f"#{str(uuid.uuid4())[:6].upper()}",
            'date_of_birth': f"{2024 - age}-01-01",
            'gender': 'male' if row.get('sex', 1) == 1 else 'female',
            'age': age,
            'cholesterol': float(row.get('chol', 200)),
            'resting_bp': float(row.get('trestbps', 120)),
            'max_heart_rate': float(row.get('thalach', 150)),
            'heart_disease': bool(row.get('target', 0)),
            'diabetes': False,
            'status': 'discharged',
            'ward': 'Cardiology',
            'diagnosis': 'Coronary Artery Disease' if row.get('target', 0) else 'Cardiac Screening',
            'dataset_source': 'heart_disease_uci',
            'admission_date': datetime.now().isoformat(),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        })
    return patients


def transform_diabetes(df: pd.DataFrame) -> list:
    """Transform Diabetes 130-US Hospitals dataset."""
    logger.info("Transforming Diabetes dataset...")
    patients = []
    for _, row in df.head(500).iterrows():  # limit for demo
        age_str = str(row.get('age', '[50-60)'))
        age = 55  # default mid-range
        try:
            age = int(age_str.strip('[)').split('-')[0]) + 5
        except Exception:
            pass

        patients.append({
            'id': str(uuid.uuid4()),
            'patient_id': f"DM{str(uuid.uuid4())[:8].upper()}",
            'first_name': 'Patient',
            'last_name': f"#{str(uuid.uuid4())[:6].upper()}",
            'date_of_birth': f"{2024 - age}-01-01",
            'gender': 'male' if str(row.get('gender', 'Male')).lower() == 'male' else 'female',
            'age': age,
            'cholesterol': None,
            'resting_bp': None,
            'max_heart_rate': None,
            'heart_disease': False,
            'diabetes': True,
            'status': 'discharged',
            'ward': 'Endocrinology',
            'diagnosis': 'Type 2 Diabetes Mellitus',
            'dataset_source': 'diabetes_130_hospitals',
            'admission_date': datetime.now().isoformat(),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        })
    return patients


def load_patients_to_rds(patients: list, conn) -> int:
    """Bulk insert patients into RDS PostgreSQL."""
    if not patients:
        return 0

    cursor = conn.cursor()
    columns = ['id', 'patient_id', 'first_name', 'last_name', 'date_of_birth',
               'gender', 'age', 'cholesterol', 'resting_bp', 'max_heart_rate',
               'heart_disease', 'diabetes', 'status', 'ward', 'diagnosis',
               'dataset_source', 'admission_date', 'created_at', 'updated_at']

    values = [[p.get(c) for c in columns] for p in patients]

    sql = f"""
        INSERT INTO patients ({', '.join(columns)})
        VALUES %s
        ON CONFLICT (patient_id) DO NOTHING
    """
    execute_values(cursor, sql, values)
    inserted = cursor.rowcount
    conn.commit()
    cursor.close()
    logger.info(f"Inserted {inserted} patients into RDS")
    return inserted


def lambda_handler(event, context):
    """Main Lambda handler — supports both S3 events and direct API invocations."""
    logger.info(f"ETL Pipeline triggered: {json.dumps(event)}")

    results = {
        'status': 'success',
        'processed_files': [],
        'total_records': 0,
        'timestamp': datetime.now().isoformat()
    }

    try:
        conn = get_db_connection()
        logger.info("✅ Connected to RDS PostgreSQL")

        # ── S3 Event trigger ────────────────────────────────────────────────
        if 'Records' in event:
            for record in event['Records']:
                bucket = record['s3']['bucket']['name']
                key = record['s3']['object']['key']

                df = read_csv_from_s3(bucket, key)
                dataset_type = detect_dataset_type(df)
                logger.info(f"Detected dataset type: {dataset_type}")

                if dataset_type == 'heart_disease':
                    patients = transform_heart_disease(df)
                elif dataset_type == 'diabetes':
                    patients = transform_diabetes(df)
                else:
                    logger.warning(f"Unknown dataset type for {key}, skipping...")
                    continue

                count = load_patients_to_rds(patients, conn)
                results['processed_files'].append({'key': key, 'records': count})
                results['total_records'] += count

        # ── Direct invocation (manual trigger / scheduled) ──────────────────
        elif 'action' in event:
            if event['action'] == 'process_sample':
                logger.info("Processing built-in sample data...")
                sample_patients = generate_sample_patients(int(event.get('count', 50)))
                count = load_patients_to_rds(sample_patients, conn)
                results['total_records'] = count
                results['processed_files'].append({'key': 'sample_data', 'records': count})

        conn.close()
        logger.info(f"ETL complete: {results}")
        return {'statusCode': 200, 'body': json.dumps(results)}

    except Exception as e:
        logger.error(f"ETL pipeline error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'status': 'error', 'message': str(e)})
        }


def generate_sample_patients(count: int = 50) -> list:
    """Generate sample patient records for testing."""
    import random
    diagnoses = ['Hypertension', 'Type 2 Diabetes', 'COPD', 'Heart Failure', 'Pneumonia']
    wards = ['ICU', 'Cardiology', 'General', 'Emergency', 'Oncology']
    return [{
        'id': str(uuid.uuid4()),
        'patient_id': f"SMP{str(uuid.uuid4())[:8].upper()}",
        'first_name': f"Patient",
        'last_name': f"#{i+1:04d}",
        'date_of_birth': f"{random.randint(1940, 2000)}-{random.randint(1,12):02d}-01",
        'gender': random.choice(['male', 'female']),
        'age': random.randint(25, 85),
        'cholesterol': round(random.uniform(150, 320), 1),
        'resting_bp': round(random.uniform(90, 160), 1),
        'max_heart_rate': round(random.uniform(100, 200), 1),
        'heart_disease': random.random() > 0.6,
        'diabetes': random.random() > 0.7,
        'status': random.choice(['admitted', 'stable', 'critical', 'observation']),
        'ward': random.choice(wards),
        'diagnosis': random.choice(diagnoses),
        'dataset_source': 'lambda_generated',
        'admission_date': datetime.now().isoformat(),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    } for i in range(count)]
