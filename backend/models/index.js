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

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Model imports
db.User = require('./User')(sequelize);
db.Patient = require('./Patient')(sequelize);
db.VitalRecord = require('./VitalRecord')(sequelize);
db.Anomaly = require('./Anomaly')(sequelize);
db.AuditLog = require('./AuditLog')(sequelize);

// Associations
db.Patient.hasMany(db.VitalRecord, { foreignKey: 'patient_id', as: 'vitals' });
db.VitalRecord.belongsTo(db.Patient, { foreignKey: 'patient_id', as: 'patient' });

db.Patient.hasMany(db.Anomaly, { foreignKey: 'patient_id', as: 'anomalies' });
db.Anomaly.belongsTo(db.Patient, { foreignKey: 'patient_id', as: 'patient' });

db.VitalRecord.hasMany(db.Anomaly, { foreignKey: 'vital_record_id', as: 'anomalies' });
db.Anomaly.belongsTo(db.VitalRecord, { foreignKey: 'vital_record_id', as: 'vitalRecord' });

db.User.hasMany(db.AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
db.AuditLog.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

module.exports = db;
