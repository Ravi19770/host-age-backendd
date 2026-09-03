const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const TicketMessage = sequelize.define(
  "TicketMessage",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    senderType: {
      type: DataTypes.ENUM(
        "Customer",
        "Agent",
        "Admin"
      ),
      allowNull: false,
    },

    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "ticket_messages",
    timestamps: true,
  }
);

module.exports = TicketMessage;