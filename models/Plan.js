const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Plan = sequelize.define(
  "Plan",
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    billing_cycle: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "month",
    },
    max_websites: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    max_emails: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    max_pages: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "plans",
    timestamps: true,
  }
);

module.exports = Plan;

