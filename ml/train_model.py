"""
ML Model Training Script
Trains Isolation Forest anomaly detector on healthcare vitals data.
Run locally or on EC2 to produce model artifacts → upload to S3.

Usage:
    python train_model.py --data data/sample_vitals.csv --output models/
    python train_model.py --use-db  # train directly from RDS
"""

import argparse
import os
import sys
import pickle
import json
import numpy as np
import pandas as pd
from datetime import datetime

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report
except ImportError:
    print("❌ scikit-learn not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

import boto3

VITAL_FEATURES = [
    'heart_rate', 'systolic_bp', 'diastolic_bp',
    'oxygen_saturation', 'temperature',
    'respiratory_rate', 'glucose_level'
]

# Normal ranges for synthetic anomaly injection
NORMAL_RANGES = {
    'heart_rate':        (55, 100),
    'systolic_bp':       (100, 140),
    'diastolic_bp':      (60, 90),
    'oxygen_saturation': (95, 100),
    'temperature':       (36.0, 37.5),
    'respiratory_rate':  (12, 20),
    'glucose_level':     (70, 180),
}


def generate_synthetic_data(n_normal: int = 2000, n_anomaly: int = 100) -> pd.DataFrame:
    """Generate synthetic vitals dataset with labeled anomalies for evaluation."""
    np.random.seed(42)
    records = []

    # Normal records
    for _ in range(n_normal):
        record = {f: np.random.uniform(lo, hi) for f, (lo, hi) in NORMAL_RANGES.items()}
        record['is_anomaly'] = 0
        records.append(record)

    # Anomalous records
    for _ in range(n_anomaly):
        record = {f: np.random.uniform(lo, hi) for f, (lo, hi) in NORMAL_RANGES.items()}
        # Inject anomaly in 1-3 vitals
        n_affected = np.random.randint(1, 4)
        affected = np.random.choice(VITAL_FEATURES, n_affected, replace=False)
        for vital in affected:
            lo, hi = NORMAL_RANGES[vital]
            if np.random.random() > 0.5:
                record[vital] = hi * np.random.uniform(1.3, 1.8)  # spike high
            else:
                record[vital] = lo * np.random.uniform(0.4, 0.7)  # drop low
        record['is_anomaly'] = 1
        records.append(record)

    return pd.DataFrame(records).sample(frac=1, random_state=42).reset_index(drop=True)


def load_from_csv(path: str) -> pd.DataFrame:
    """Load vitals from CSV file."""
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} records from {path}")
    print(f"Columns: {list(df.columns)}")
    return df


def load_from_db() -> pd.DataFrame:
    """Load vitals from RDS PostgreSQL."""
    import psycopg2
    from dotenv import load_dotenv
    load_dotenv('../backend/.env')

    conn = psycopg2.connect(
        host=os.environ['DB_HOST'],
        dbname=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD']
    )
    query = f"""
        SELECT {', '.join(VITAL_FEATURES)}, is_anomaly
        FROM vital_records
        WHERE recorded_at > NOW() - INTERVAL '90 days'
          AND heart_rate IS NOT NULL
        LIMIT 10000
    """
    df = pd.read_sql(query, conn)
    conn.close()
    print(f"Loaded {len(df)} records from RDS")
    return df


def train(df: pd.DataFrame, output_dir: str) -> dict:
    """Train Isolation Forest and save artifacts."""
    os.makedirs(output_dir, exist_ok=True)

    # Prepare features
    X = df[VITAL_FEATURES].fillna(df[VITAL_FEATURES].median())

    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train Isolation Forest
    print("\n🔧 Training Isolation Forest...")
    model = IsolationForest(
        n_estimators=200,
        max_samples='auto',
        contamination=0.05,
        max_features=1.0,
        bootstrap=False,
        random_state=42,
        n_jobs=-1,
        verbose=0
    )
    model.fit(X_scaled)

    # Evaluate if labels available
    metrics = {}
    if 'is_anomaly' in df.columns:
        y_true = df['is_anomaly'].values
        y_pred_raw = model.predict(X_scaled)
        y_pred = (y_pred_raw == -1).astype(int)
        scores = -model.score_samples(X_scaled)

        from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score
        metrics = {
            'roc_auc': float(roc_auc_score(y_true, scores)),
            'precision': float(precision_score(y_true, y_pred, zero_division=0)),
            'recall': float(recall_score(y_true, y_pred, zero_division=0)),
            'f1': float(f1_score(y_true, y_pred, zero_division=0)),
            'n_anomalies_detected': int(y_pred.sum()),
            'n_true_anomalies': int(y_true.sum()),
        }
        print("\n📊 Model Performance:")
        for k, v in metrics.items():
            print(f"   {k}: {v:.4f}" if isinstance(v, float) else f"   {k}: {v}")

    # Save artifacts
    model_path = os.path.join(output_dir, 'isolation_forest_v1.pkl')
    scaler_path = os.path.join(output_dir, 'scaler_v1.pkl')
    meta_path = os.path.join(output_dir, 'model_metadata.json')

    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)

    metadata = {
        'model_version': '1.0.0',
        'algorithm': 'IsolationForest',
        'n_estimators': 200,
        'contamination': 0.05,
        'features': VITAL_FEATURES,
        'trained_at': datetime.now().isoformat(),
        'training_samples': len(df),
        'metrics': metrics
    }
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"\n✅ Model artifacts saved:")
    print(f"   {model_path}")
    print(f"   {scaler_path}")
    print(f"   {meta_path}")
    return metadata


def upload_to_s3(output_dir: str, bucket: str):
    """Upload trained model artifacts to S3."""
    s3 = boto3.client('s3')
    for filename in ['isolation_forest_v1.pkl', 'scaler_v1.pkl', 'model_metadata.json']:
        local = os.path.join(output_dir, filename)
        if os.path.exists(local):
            s3_key = f"models/{filename}"
            s3.upload_file(local, bucket, s3_key,
                           ExtraArgs={'ServerSideEncryption': 'AES256'})
            print(f"   Uploaded {filename} → s3://{bucket}/{s3_key}")


def main():
    parser = argparse.ArgumentParser(description='Train Healthcare Anomaly Detection Model')
    parser.add_argument('--data', type=str, help='Path to vitals CSV file')
    parser.add_argument('--use-db', action='store_true', help='Load training data from RDS')
    parser.add_argument('--synthetic', action='store_true', default=False, help='Use synthetic data')
    parser.add_argument('--output', type=str, default='models/', help='Output directory for model artifacts')
    parser.add_argument('--upload-s3', type=str, help='S3 bucket to upload model to')
    args = parser.parse_args()

    print("🏥 Healthcare Anomaly Detection — Model Training")
    print("=" * 50)

    if args.use_db:
        df = load_from_db()
    elif args.data:
        df = load_from_csv(args.data)
    else:
        print("ℹ️  No data source specified, generating synthetic training data...")
        df = generate_synthetic_data(n_normal=3000, n_anomaly=150)
        print(f"   Generated {len(df)} synthetic records")

    metadata = train(df, args.output)

    if args.upload_s3:
        print(f"\n☁️  Uploading to S3 bucket: {args.upload_s3}")
        upload_to_s3(args.output, args.upload_s3)

    print("\n🎉 Training complete!")
    print(f"   Model version: {metadata['model_version']}")
    print(f"   Trained on:    {metadata['training_samples']} samples")
    if metadata.get('metrics'):
        print(f"   ROC-AUC:       {metadata['metrics'].get('roc_auc', 'N/A'):.4f}")


if __name__ == '__main__':
    main()
