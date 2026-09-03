const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const TicketInternalNote = sequelize.define(
  "TicketInternalNote",
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

    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: "ticket_internal_notes",
    timestamps: true,
  }
);

module.exports = TicketInternalNote;