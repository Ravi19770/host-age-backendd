const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const TicketAttachment = sequelize.define(
  "TicketAttachment",
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

    messageId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    filePath: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    fileType: {
      type: DataTypes.STRING,
    },

    fileSize: {
      type: DataTypes.INTEGER,
    },
  },
  {
    tableName: "ticket_attachments",
    timestamps: true,
  }
);

module.exports = TicketAttachment;