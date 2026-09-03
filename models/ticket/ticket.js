const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const Ticket = sequelize.define(
  "Ticket",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    ticketNumber: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },

    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    department: {
      type: DataTypes.ENUM(
        "Technical",
        "Billing",
        "Sales",
        "Domains",
        "Email Hosting"
      ),
      defaultValue: "Technical",
    },

    priority: {
      type: DataTypes.ENUM(
        "Low",
        "Medium",
        "High",
        "Critical"
      ),
      defaultValue: "Medium",
    },

    status: {
      type: DataTypes.ENUM(
        "Open",
        "Pending",
        "In Progress",
        "Resolved",
        "Closed"
      ),
      defaultValue: "Open",
    },

    assignedAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "tickets",
    timestamps: true,
  }
);

module.exports = Ticket;