const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'healthcare_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'Hanees@2001',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

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
