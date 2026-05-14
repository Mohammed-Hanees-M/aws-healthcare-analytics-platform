"""
Script: Load Kaggle Datasets into PostgreSQL
Run this once to populate the database with real healthcare data.

Usage:
    cd scripts
    python load_kaggle_data.py

Prerequisites:
    pip install kaggle pandas psycopg2-binary python-dotenv
    Place kaggle.json at ~/.kaggle/kaggle.json
"""

import os
import sys
import subprocess
import tempfile
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import uuid
from datetime import datetime, timedelta
import random

# Load .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    raise ValueError("DATABASE_URL must be set in environment")
DB_CONFIG = {}

WARDS = ['ICU', 'Cardiology', 'Oncology', 'Pediatrics', 'Emergency', 'General', 'Neurology', 'Orthopedics']
PHYSICIANS = ['Dr. Sarah Chen', 'Dr. James Wilson', 'Dr. Priya Patel', 'Dr. Michael Lee', 'Dr. Anna Rodriguez']
FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Barbara']
LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor']


def get_conn():
    if DB_URL:
        return psycopg2.connect(DB_URL)
    return psycopg2.connect(**DB_CONFIG)


def download_kaggle_dataset(dataset: str, dest: str):
    """Download dataset using kaggle CLI."""
    print(f"  📥 Downloading {dataset}...")
    result = subprocess.run(
        ['kaggle', 'datasets', 'download', '-d', dataset, '-p', dest, '--unzip'],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  ⚠️  Kaggle download failed: {result.stderr.strip()}")
        print(f"  → Generating synthetic data instead")
        return False
    print(f"  ✅ Downloaded {dataset}")
    return True


def transform_heart_disease_csv(path: str) -> list:
    """Transform heart disease CSV to patient insert rows."""
    df = pd.read_csv(path)
    print(f"  Loaded {len(df)} heart disease records")
    patients = []
    for _, row in df.iterrows():
        age = int(row.get('age', random.randint(40, 80)))
        dob_year = datetime.now().year - age
        rand_days = random.randint(0, 30)
        patients.append((
            str(uuid.uuid4()),
            f"HD{str(uuid.uuid4())[:8].upper()}",
            random.choice(FIRST_NAMES),
            random.choice(LAST_NAMES),
            f"{dob_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            'male' if row.get('sex', 1) == 1 else 'female',
            age,
            float(row.get('chol', 0)) or None,
            float(row.get('trestbps', 0)) or None,
            float(row.get('thalach', 0)) or None,
            bool(row.get('target', 0)),
            False,
            random.choice(['admitted', 'stable', 'discharged', 'observation']),
            random.choice(WARDS),
            'Coronary Artery Disease' if row.get('target', 0) else 'Cardiac Evaluation',
            random.choice(PHYSICIANS),
            (datetime.now() - timedelta(days=rand_days)).isoformat(),
            'heart_disease_uci',
            datetime.now().isoformat(),
            datetime.now().isoformat()
        ))
    return patients


def generate_synthetic_patients(n: int = 200) -> list:
    """Generate synthetic patients when Kaggle is unavailable."""
    diagnoses = [
        'Hypertension', 'Type 2 Diabetes', 'COPD', 'Heart Failure',
        'Pneumonia', 'Sepsis', 'Stroke', 'Renal Failure', 'Atrial Fibrillation'
    ]
    statuses = ['admitted', 'stable', 'critical', 'observation', 'discharged']
    patients = []
    for i in range(n):
        age = random.randint(25, 90)
        dob_year = datetime.now().year - age
        rand_days = random.randint(0, 45)
        patients.append((
            str(uuid.uuid4()),
            f"SYN{str(i+1).zfill(5)}",
            random.choice(FIRST_NAMES),
            random.choice(LAST_NAMES),
            f"{dob_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            random.choice(['male', 'female']),
            age,
            round(random.uniform(150, 320), 1),
            round(random.uniform(90, 165), 1),
            round(random.uniform(100, 200), 1),
            random.random() > 0.55,
            random.random() > 0.65,
            random.choice(statuses),
            random.choice(WARDS),
            random.choice(diagnoses),
            random.choice(PHYSICIANS),
            (datetime.now() - timedelta(days=rand_days)).isoformat(),
            'synthetic_seed',
            datetime.now().isoformat(),
            datetime.now().isoformat()
        ))
    return patients


def insert_patients(conn, patients: list) -> int:
    cursor = conn.cursor()
    sql = """
        INSERT INTO patients (
            id, patient_id, first_name, last_name, date_of_birth,
            gender, age, cholesterol, resting_bp, max_heart_rate,
            heart_disease, diabetes, status, ward, diagnosis,
            attending_physician, admission_date, dataset_source,
            created_at, updated_at
        ) VALUES %s
        ON CONFLICT (patient_id) DO NOTHING
    """
    execute_values(cursor, sql, patients)
    count = cursor.rowcount
    conn.commit()
    cursor.close()
    return count


def insert_vitals_for_patients(conn):
    """Generate 48h of vital records for all admitted patients."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id FROM patients
        WHERE status IN ('admitted', 'critical', 'stable', 'observation')
        LIMIT 80
    """)
    patient_ids = [r[0] for r in cursor.fetchall()]
    cursor.close()

    vitals = []
    for pid in patient_ids:
        for h in range(48, 0, -1):
            ts = datetime.now() - timedelta(hours=h)
            is_anomaly = random.random() < 0.04
            vitals.append((
                str(uuid.uuid4()),
                pid,
                ts.isoformat(),
                round(random.uniform(130, 175) if is_anomaly else random.uniform(58, 102), 1),
                round(random.uniform(165, 205) if is_anomaly else random.uniform(102, 140), 1),
                round(random.uniform(105, 125) if is_anomaly else random.uniform(62, 90), 1),
                round(random.uniform(36.0, 38.5), 1),
                round(random.uniform(82, 91) if is_anomaly else random.uniform(94, 99), 1),
                round(random.uniform(28, 38) if is_anomaly else random.uniform(12, 22), 1),
                round(random.uniform(300, 480) if is_anomaly else random.uniform(72, 195), 1),
                round(random.uniform(55, 100), 1),
                round(random.uniform(18, 35), 1),
                random.randint(0, 10),
                random.choice(['Nurse A', 'Nurse B', 'Nurse C']),
                is_anomaly,
                round(random.uniform(0.75, 0.99) if is_anomaly else random.uniform(0.01, 0.25), 3),
                ts.isoformat(),
                ts.isoformat()
            ))

    cursor = conn.cursor()
    execute_values(cursor, """
        INSERT INTO vital_records (
            id, patient_id, recorded_at,
            heart_rate, systolic_bp, diastolic_bp, temperature,
            oxygen_saturation, respiratory_rate, glucose_level,
            weight_kg, bmi, pain_level, recorded_by,
            is_anomaly, anomaly_score, created_at, updated_at
        ) VALUES %s ON CONFLICT DO NOTHING
    """, vitals)
    count = cursor.rowcount
    conn.commit()
    cursor.close()
    return count


def main():
    print("\n🏥 Healthcare Analytics — Kaggle Data Loader")
    print("=" * 50)

    try:
        conn = get_conn()
        print("✅ Connected to PostgreSQL")
    except Exception as e:
        print(f"❌ DB connection failed: {e}")
        print("   Make sure PostgreSQL is running and .env is configured.")
        sys.exit(1)

    total_patients = 0

    with tempfile.TemporaryDirectory() as tmpdir:
        # Try Kaggle Heart Disease dataset
        success = download_kaggle_dataset('ronitf/heart-disease-uci', tmpdir)
        if success:
            csv_path = os.path.join(tmpdir, 'heart.csv')
            if os.path.exists(csv_path):
                patients = transform_heart_disease_csv(csv_path)
                n = insert_patients(conn, patients)
                print(f"  ✅ Inserted {n} heart disease patients")
                total_patients += n

    # Always add synthetic patients to reach good demo volume
    print("\n🔧 Generating synthetic patient records...")
    synthetic = generate_synthetic_patients(200)
    n = insert_patients(conn, synthetic)
    print(f"  ✅ Inserted {n} synthetic patients")
    total_patients += n

    # Generate vitals
    print("\n📈 Generating 48h vitals records for admitted patients...")
    vitals_count = insert_vitals_for_patients(conn)
    print(f"  ✅ Inserted {vitals_count} vital records")

    conn.close()

    print(f"\n🎉 Done! Database loaded:")
    print(f"   Total patients:      {total_patients}")
    print(f"   Vital records:       {vitals_count}")
    print(f"\nOpen http://localhost:3000 and login with admin@hospital.com / Admin@2025")


if __name__ == '__main__':
    main()
