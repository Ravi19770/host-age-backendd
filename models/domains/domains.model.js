const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const Domain = sequelize.define(
  "Domain",
  {
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    domain: {
      type: DataTypes.STRING(253),
      allowNull: false,
      unique: true,
    },

    verificationToken: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },

    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    status: {
      type: DataTypes.ENUM(
        "pending",
        "verified",
        "rejected",
        "suspended"
      ),
      allowNull: false,
      defaultValue: "pending",
    },

    autoRenew: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    renewalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    renewalStatus: {
      type: DataTypes.ENUM(
        "ACTIVE",
        "PENDING",
        "EXPIRED",
        "FAILED",
        "CANCELLED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    },

    nextRenewalDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    payment: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        isPaid: false,
        orderId: null,
        paymentId: null,
        signature: null,
        amount: 0,
        currency: "INR",
        paidAt: null,
      },
    },

    crawler: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        lastCrawledAt: null,
        crawlStatus: "idle",
        score: 0,
        issues: [],
      },
    },

    moderation: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        status: "safe",
        reason: null,
        flaggedAt: null,
        flags: {},
      },
    },

    technology: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        cms: null,
        framework: null,
        frontend: null,
        backend: null,
        server: null,
      },
    },

    metrics: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        visits: 0,
        lastActiveAt: null,
      },
    },
  },
  {
    tableName: "domains",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["domain"],
      },
      {
        fields: ["userId"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["expiryDate"],
      },
    ],
  }
);

module.exports = Domain;