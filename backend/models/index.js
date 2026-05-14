const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

module.exports = sequelize;

// Model imports
const User = require('./User')(sequelize);
const Patient = require('./Patient')(sequelize);
const VitalRecord = require('./VitalRecord')(sequelize);
const Anomaly = require('./Anomaly')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);

// ─── Associations ──────────────────────────────────────────────────────────────
Patient.hasMany(VitalRecord, { foreignKey: 'patient_id', as: 'vitals' });
VitalRecord.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

Patient.hasMany(Anomaly, { foreignKey: 'patient_id', as: 'anomalies' });
Anomaly.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

VitalRecord.hasMany(Anomaly, { foreignKey: 'vital_record_id', as: 'anomalies' });
Anomaly.belongsTo(VitalRecord, { foreignKey: 'vital_record_id', as: 'vitalRecord' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { sequelize, User, Patient, VitalRecord, Anomaly, AuditLog };
