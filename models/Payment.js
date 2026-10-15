const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Payment = sequelize.define(
  "Payment",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    paymentId: { type: DataTypes.STRING, allowNull: false, unique: true },
    razorpayOrderId: { type: DataTypes.STRING, allowNull: false },
    razorpayPaymentId: { type: DataTypes.STRING, allowNull: true },
    razorpaySignature: { type: DataTypes.TEXT, allowNull: true },

    customerName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "INR" },

    plan: { type: DataTypes.STRING, allowNull: true },
    domain: { type: DataTypes.STRING, allowNull: true },

    status: {
      type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED", "REFUNDED"),
      defaultValue: "PENDING",
    },

    paymentMethod: {
      type: DataTypes.ENUM("CARD", "UPI", "NETBANKING", "WALLET"),
      allowNull: true,
    },

    invoiceNumber: { type: DataTypes.STRING, allowNull: true },
    invoicePath: { type: DataTypes.STRING, allowNull: true },
    bitrixContactId: { type: DataTypes.STRING, allowNull: true },
    bitrixDealId: { type: DataTypes.STRING, allowNull: true },
  },
  { tableName: "payments", timestamps: true }
);

module.exports = Payment;

