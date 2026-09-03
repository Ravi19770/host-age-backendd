const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const EmailPage = sequelize.define(
  "EmailPage",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Email username
    // Example: support
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        is: /^[a-z0-9._-]+$/i,
      },
    },

    // Complete email address
    // Example: support@example.com
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },

    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    domain: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Requested mailbox storage in GB
    quota: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      allowNull: false,
    },

    // Why user needs this mailbox
    // Example: Sales, Support, Admin
    purpose: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "pending",
        "creating",
        "active",
        "failed"
      ),
      defaultValue: "pending",
    },

    mailboxLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },

    createdBy: {
      type: DataTypes.STRING,
      defaultValue: "system",
    },
  },
  {
    tableName: "email_pages",
    timestamps: true,
  }
);

// Existing User relationship
EmailPage.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

User.hasMany(EmailPage, {
  foreignKey: "userId",
  as: "emailPages",
});

module.exports = EmailPage;