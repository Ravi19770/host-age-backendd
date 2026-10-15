const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "audit_logs",
    timestamps: true,
  }
);

/**
 * Helper to record an audit action
 */
AuditLog.log = async function ({ action, entity, entityId = null, userId = null, payload = null }) {
  try {
    return await AuditLog.create({
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      userId: userId ? String(userId) : null,
      payload,
    });
  } catch (err) {
    console.error("❌ AUDIT LOG ERROR:", err.message);
    return null;
  }
};

module.exports = AuditLog;

