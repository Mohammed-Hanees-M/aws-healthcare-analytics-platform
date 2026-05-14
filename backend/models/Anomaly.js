const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Anomaly = sequelize.define('Anomaly', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patient_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    vital_record_id: {
      type: DataTypes.UUID
    },
    anomaly_type: {
      type: DataTypes.ENUM(
        'heart_rate_critical', 'bp_critical', 'oxygen_low',
        'temperature_critical', 'glucose_critical', 'multi_vital_anomaly'
      )
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium'
    },
    score: { type: DataTypes.FLOAT },
    description: { type: DataTypes.TEXT },
    vital_values: { type: DataTypes.JSONB },
    ml_model_version: { type: DataTypes.STRING(20) },
    is_acknowledged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    acknowledged_by: { type: DataTypes.STRING(100) },
    acknowledged_at: { type: DataTypes.DATE },
    action_taken: { type: DataTypes.TEXT }
  }, {
    tableName: 'anomalies',
    timestamps: true,
    underscored: true
  });

  return Anomaly;
};
