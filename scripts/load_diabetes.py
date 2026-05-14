import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import uuid
from datetime import datetime, timedelta
import random
import os
from dotenv import dotenv_values

# Load credentials from backend/.env so this script targets the same
# AWS RDS instance that the Node.js backend queries.
_env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
_cfg = dotenv_values(_env_path)

# Database connection
db_url = _cfg.get('DATABASE_URL') or os.environ.get('DATABASE_URL')

    if not db_url:
        raise ValueError("DATABASE_URL must be set in environment")
    conn = psycopg2.connect(db_url)

print("✅ Connected to database")

# Read the CSV
df = pd.read_csv(r"C:\Users\hanee\Downloads\archive\diabetic_data.csv")
print(f"✅ Loaded {len(df)} rows from diabetic_data.csv")
print(f"   Columns: {list(df.columns)[:8]}...")

WARDS = ['ICU', 'Cardiology', 'Endocrinology', 'General', 'Emergency', 'Pediatrics']
PHYSICIANS = ['Dr. Sarah Chen', 'Dr. James Wilson', 'Dr. Priya Patel', 'Dr. Michael Lee']
FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Barbara', 'David', 'Susan', 'Richard', 'Jessica', 'Thomas']
LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris']

def parse_age(age_str):
    try:
        age_str = str(age_str).strip('[)(]')
        parts = age_str.replace(')', '').replace(']', '').replace('[', '').replace('(', '').split('-')
        return int(parts[0]) + 5
    except:
        return random.randint(40, 75)

def get_status(readmitted):
    r = str(readmitted).strip()
    if r == '<30':
        return 'critical'
    elif r == '>30':
        return 'observation'
    else:
        return random.choice(['admitted', 'stable', 'discharged'])

patients = []
# Load up to 500 records
for _, row in df.head(500).iterrows():
    age = parse_age(row.get('age', 50))
    dob_year = 2026 - age
    rand_days = random.randint(0, 45)
    admission_date = datetime.now() - timedelta(days=rand_days)

    patients.append((
        str(uuid.uuid4()),
        f"DM{str(uuid.uuid4())[:8].upper()}",
        random.choice(FIRST_NAMES),
        random.choice(LAST_NAMES),
        f"{dob_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
        'male' if str(row.get('gender', 'Male')).lower() == 'male' else 'female',
        age,
        None,   # cholesterol
        None,   # resting_bp
        None,   # max_heart_rate
        False,  # heart_disease
        True,   # diabetes = True (this is diabetes dataset)
        get_status(row.get('readmitted', 'NO')),
        random.choice(WARDS),
        'Type 2 Diabetes Mellitus',
        random.choice(PHYSICIANS),
        admission_date.isoformat(),
        'diabetes_130_hospitals',
        datetime.now().isoformat(),
        datetime.now().isoformat()
    ))

cursor = conn.cursor()
execute_values(cursor, """
    INSERT INTO patients (
        id, patient_id, first_name, last_name, date_of_birth,
        gender, age, cholesterol, resting_bp, max_heart_rate,
        heart_disease, diabetes, status, ward, diagnosis,
        attending_physician, admission_date, dataset_source,
        created_at, updated_at
    ) VALUES %s
    ON CONFLICT (patient_id) DO NOTHING
""", patients)

inserted = cursor.rowcount
conn.commit()
cursor.close()

print(f"✅ Inserted {inserted} diabetic patients into database")
print(f"   Dataset source: diabetes_130_hospitals (Kaggle)")
print(f"   Total loaded: 500 records from {len(df)} available")

# Now generate vitals for new patients
cursor = conn.cursor()
cursor.execute("""
    SELECT id FROM patients 
    WHERE dataset_source = 'diabetes_130_hospitals'
    LIMIT 100
""")
patient_ids = [r[0] for r in cursor.fetchall()]
cursor.close()

vitals = []
for pid in patient_ids:
    for h in range(24, 0, -1):
        ts = datetime.now() - timedelta(hours=h)
        # Diabetic patients have higher glucose
        glucose = random.uniform(180, 380)
        is_anomaly = glucose > 300 or random.random() < 0.05
        vitals.append((
            str(uuid.uuid4()),
            pid,
            ts.isoformat(),
            round(random.uniform(60, 105), 1),   # heart_rate
            round(random.uniform(110, 155), 1),  # systolic_bp (slightly high)
            round(random.uniform(70, 95), 1),    # diastolic_bp
            round(random.uniform(36.0, 38.5), 1),# temperature
            round(random.uniform(93, 99), 1),    # oxygen_saturation
            round(random.uniform(14, 22), 1),    # respiratory_rate
            round(glucose, 1),                   # glucose_level (high for diabetics)
            round(random.uniform(60, 110), 1),   # weight_kg
            round(random.uniform(22, 38), 1),    # bmi
            random.randint(0, 7),
            random.choice(['Nurse A', 'Nurse B', 'Nurse C']),
            is_anomaly,
            round(random.uniform(0.75, 0.95) if is_anomaly else random.uniform(0.01, 0.3), 3),
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
v_count = cursor.rowcount
conn.commit()
cursor.close()
conn.close()

print(f"✅ Generated {v_count} vital records for diabetic patients")
print(f"\n🎉 Done! Refresh your dashboard at http://localhost:3000")
print(f"   You should now see 600+ total patients (100 original + 500 diabetic)")