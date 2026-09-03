const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/db");

const User = sequelize.define(
  "User",
  {
    // ==============================
    // ID
    // ==============================
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ==============================
    // USER INFORMATION
    // ==============================
    fullName: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Full name is required",
        },
        len: {
          args: [2, 120],
          msg: "Full name must be between 2 and 120 characters",
        },
      },
    },

    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: {
        name: "unique_email",
        msg: "Email already exists",
      },
      validate: {
        notEmpty: {
          msg: "Email is required",
        },
        isEmail: {
          msg: "Invalid email format",
        },
      },
    },

    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: {
        name: "unique_phone",
        msg: "Phone already exists",
      },
      validate: {
        is: {
          args: /^[0-9+\-() ]*$/,
          msg: "Invalid phone number format",
        },
      },
    },

    // ==============================
    // PASSWORD
    // ==============================
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: {
          args: [60, 255],
          msg: "Invalid password hash",
        },
      },
    },

    // ==============================
    // ROLE
    // ==============================
    role: {
      type: DataTypes.ENUM("USER", "ADMIN"),
      allowNull: false,
      defaultValue: "USER",
    },

    // ==============================
    // ACCOUNT STATUS
    // ==============================
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    // ==============================
    // EMAIL VERIFICATION
    // ==============================
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // ==============================
    // PASSWORD RESET
    // ==============================
    resetToken: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },

    resetTokenExpire: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // ==============================
    // LOGIN TRACKING
    // ==============================
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "users",

    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        fields: ["phone"],
      },
      {
        fields: ["resetToken"],
      },
    ],

    hooks: {
      // Hash password on CREATE
      beforeCreate: async (user) => {
        if (user.password && !user.password.startsWith("$2")) {
          user.password = await bcrypt.hash(
            user.password,
            12
          );
        }
      },

      // Hash password only when changed
      beforeUpdate: async (user) => {
        if (
          user.changed("password") &&
          user.password &&
          !user.password.startsWith("$2")
        ) {
          user.password = await bcrypt.hash(
            user.password,
            12
          );
        }
      },
    },
  }
);

// ==============================
// COMPARE PASSWORD
// ==============================

User.prototype.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// ==============================
// SAFE JSON RESPONSE
// ==============================

User.prototype.toJSON = function () {
  const values = { ...this.get() };

  delete values.password;
  delete values.resetToken;
  delete values.resetTokenExpire;

  return values;
};

module.exports = User;