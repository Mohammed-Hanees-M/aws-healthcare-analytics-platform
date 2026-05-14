require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const { sequelize, User, Patient, VitalRecord, Anomaly } = require('../models');

const WARDS = ['ICU', 'Cardiology', 'Oncology', 'Pediatrics', 'Emergency', 'General'];
const DIAGNOSES = [
  'Hypertension', 'Type 2 Diabetes', 'Coronary Artery Disease',
  'Heart Failure', 'COPD', 'Pneumonia', 'Sepsis', 'Stroke', 'Renal Failure'
];

function randFloat(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    console.log('✅ Database synced');

    // Seed users
    const salt = await bcrypt.genSalt(12);
    const users = await User.bulkCreate([
      { name: 'Dr. Sarah Admin', email: 'admin@hospital.com', password_hash: await bcrypt.hash('Admin@2025', salt), role: 'admin', department: 'Administration' },
      { name: 'Dr. James Wilson', email: 'doctor@hospital.com', password_hash: await bcrypt.hash('Doctor@2025', salt), role: 'doctor', department: 'Cardiology' },
      { name: 'Nurse Emily Chen', email: 'nurse@hospital.com', password_hash: await bcrypt.hash('Nurse@2025', salt), role: 'nurse', department: 'ICU' },
      { name: 'Alex Analyst', email: 'analyst@hospital.com', password_hash: await bcrypt.hash('Analyst@2025', salt), role: 'analyst', department: 'Data Analytics' }
    ]);
    console.log(`✅ Seeded ${users.length} users`);

    // Seed patients (100 sample patients)
    const patientsData = [];
    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Barbara', 'David', 'Susan'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas'];
    const statuses = ['admitted', 'stable', 'critical', 'observation', 'discharged'];
    const physicians = ['Dr. James Wilson', 'Dr. Sarah Lee', 'Dr. Michael Chen', 'Dr. Anna Patel'];

    for (let i = 1; i <= 100; i++) {
      const admissionDate = new Date(Date.now() - randInt(0, 30) * 24 * 60 * 60 * 1000);
      const status = randItem(statuses);
      patientsData.push({
        patient_id: `P${String(i).padStart(5, '0')}`,
        first_name: randItem(firstNames),
        last_name: randItem(lastNames),
        date_of_birth: new Date(1940 + randInt(0, 70), randInt(0, 11), randInt(1, 28)),
        gender: randItem(['male', 'female']),
        blood_type: randItem(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
        diagnosis: randItem(DIAGNOSES),
        admission_date: admissionDate,
        discharge_date: status === 'discharged' ? new Date(admissionDate.getTime() + randInt(1, 10) * 24 * 60 * 60 * 1000) : null,
        status,
        ward: randItem(WARDS),
        attending_physician: randItem(physicians),
        age: randInt(25, 90),
        cholesterol: randFloat(150, 320),
        resting_bp: randFloat(90, 160),
        max_heart_rate: randFloat(100, 200),
        diabetes: Math.random() > 0.7,
        heart_disease: Math.random() > 0.6,
        dataset_source: 'seed_data'
      });
    }

    const patients = await Patient.bulkCreate(patientsData);
    console.log(`✅ Seeded ${patients.length} patients`);

    // Seed vital records (last 48h for each patient)
    const vitalsData = [];
    for (const patient of patients.slice(0, 50)) {
      for (let h = 47; h >= 0; h--) {
        vitalsData.push({
          patient_id: patient.id,
          recorded_at: new Date(Date.now() - h * 60 * 60 * 1000),
          heart_rate: randFloat(55, 110),
          systolic_bp: randFloat(100, 160),
          diastolic_bp: randFloat(60, 100),
          temperature: randFloat(36.0, 38.5),
          oxygen_saturation: randFloat(93, 100),
          respiratory_rate: randFloat(12, 22),
          glucose_level: randFloat(80, 200),
          weight_kg: randFloat(55, 100),
          bmi: randFloat(18.5, 35),
          pain_level: randInt(0, 10),
          recorded_by: randItem(['Nurse Emily Chen', 'Nurse John Doe']),
          is_anomaly: false,
          anomaly_score: randFloat(0, 0.3)
        });
      }
    }

    // Inject some anomalous readings
    for (let i = 0; i < 20; i++) {
      const patient = patients[randInt(0, 49)];
      vitalsData.push({
        patient_id: patient.id,
        recorded_at: new Date(Date.now() - randInt(0, 6) * 60 * 60 * 1000),
        heart_rate: randFloat(130, 180),       // Critical high HR
        systolic_bp: randFloat(170, 210),       // Hypertensive crisis
        diastolic_bp: randFloat(110, 130),
        temperature: randFloat(39.5, 41.0),    // High fever
        oxygen_saturation: randFloat(82, 90),  // Hypoxia
        respiratory_rate: randFloat(28, 40),
        glucose_level: randFloat(300, 500),
        weight_kg: randFloat(55, 100),
        bmi: randFloat(18.5, 35),
        pain_level: randInt(7, 10),
        recorded_by: randItem(['Nurse Emily Chen', 'Nurse John Doe']),
        is_anomaly: true,
        anomaly_score: randFloat(0.75, 0.99)
      });
    }

    await VitalRecord.bulkCreate(vitalsData);
    console.log(`✅ Seeded ${vitalsData.length} vital records`);

    // Seed anomalies
    const anomalyTypes = ['heart_rate_critical', 'bp_critical', 'oxygen_low', 'temperature_critical', 'glucose_critical'];
    const anomaliesData = patients.slice(0, 15).map((p, i) => ({
      patient_id: p.id,
      anomaly_type: randItem(anomalyTypes),
      severity: randItem(['medium', 'high', 'critical']),
      score: randFloat(0.75, 0.99),
      description: `Abnormal vital signs detected by ML anomaly detection model`,
      vital_values: { hr: randFloat(130, 180), spo2: randFloat(82, 90), bp: `${randInt(170, 210)}/${randInt(110, 130)}` },
      ml_model_version: '1.0.0',
      is_acknowledged: i > 8
    }));

    await Anomaly.bulkCreate(anomaliesData);
    console.log(`✅ Seeded ${anomaliesData.length} anomalies`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('─────────────────────────────────');
    console.log('Login credentials:');
    console.log('  Admin:   admin@hospital.com    / Admin@2025');
    console.log('  Doctor:  doctor@hospital.com   / Doctor@2025');
    console.log('  Nurse:   nurse@hospital.com    / Nurse@2025');
    console.log('  Analyst: analyst@hospital.com  / Analyst@2025');
    console.log('─────────────────────────────────');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
