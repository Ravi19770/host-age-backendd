const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const TicketHistory = sequelize.define(
  "TicketHistory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    oldValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    newValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    performedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "ticket_histories",
    timestamps: true,
  }
);

module.exports = TicketHistory;