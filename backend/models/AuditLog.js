const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: { type: DataTypes.UUID },
    action: { type: DataTypes.STRING(100), allowNull: false },
    resource: { type: DataTypes.STRING(100) },
    resource_id: { type: DataTypes.STRING(100) },
    ip_address: { type: DataTypes.INET },
    user_agent: { type: DataTypes.TEXT },
    request_body: { type: DataTypes.JSONB },
    response_status: { type: DataTypes.INTEGER },
    duration_ms: { type: DataTypes.INTEGER }
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    underscored: true,
    updatedAt: false
  });

  return AuditLog;
};
