const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VitalRecord = sequelize.define('VitalRecord', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patient_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'patients', key: 'id' }
    },
    recorded_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    heart_rate: { type: DataTypes.FLOAT },
    systolic_bp: { type: DataTypes.FLOAT },
    diastolic_bp: { type: DataTypes.FLOAT },
    temperature: { type: DataTypes.FLOAT },
    oxygen_saturation: { type: DataTypes.FLOAT },
    respiratory_rate: { type: DataTypes.FLOAT },
    glucose_level: { type: DataTypes.FLOAT },
    weight_kg: { type: DataTypes.FLOAT },
    bmi: { type: DataTypes.FLOAT },
    pain_level: { type: DataTypes.INTEGER },
    notes: { type: DataTypes.TEXT },
    recorded_by: { type: DataTypes.STRING(100) },
    is_anomaly: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    anomaly_score: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    }
  }, {
    tableName: 'vital_records',
    timestamps: true,
    underscored: true
  });

  return VitalRecord;
};
