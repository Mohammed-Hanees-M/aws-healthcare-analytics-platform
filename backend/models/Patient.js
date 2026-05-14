const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Patient = sequelize.define('Patient', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patient_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other')
    },
    blood_type: {
      type: DataTypes.STRING(5)
    },
    diagnosis: {
      type: DataTypes.TEXT
    },
    admission_date: {
      type: DataTypes.DATE
    },
    discharge_date: {
      type: DataTypes.DATE
    },
    status: {
      type: DataTypes.ENUM('admitted', 'discharged', 'critical', 'stable', 'observation'),
      defaultValue: 'admitted'
    },
    ward: {
      type: DataTypes.STRING(50)
    },
    attending_physician: {
      type: DataTypes.STRING(100)
    },
    insurance_id: {
      type: DataTypes.STRING(50)
    },
    // Kaggle dataset fields
    age: { type: DataTypes.INTEGER },
    cholesterol: { type: DataTypes.FLOAT },
    resting_bp: { type: DataTypes.FLOAT },
    max_heart_rate: { type: DataTypes.FLOAT },
    diabetes: { type: DataTypes.BOOLEAN, defaultValue: false },
    heart_disease: { type: DataTypes.BOOLEAN, defaultValue: false },
    dataset_source: { type: DataTypes.STRING(100) }
  }, {
    tableName: 'patients',
    timestamps: true,
    underscored: true
  });

  return Patient;
};
