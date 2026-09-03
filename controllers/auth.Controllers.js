const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ========================================
// HELPERS
// ========================================

const normalizeEmail = (email) => {
  if (typeof email !== "string") return null;

  return email.trim().toLowerCase();
};

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || "user",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const sanitizeUser = (user) => {
  const data = user.toJSON ? user.toJSON() : { ...user };

  delete data.password;
  delete data.resetToken;
  delete data.resetTokenExpire;

  return data;
};

const validatePassword = (password) => {
  if (typeof password !== "string") {
    return false;
  }

  // Minimum 8 characters
  return password.length >= 8;
};

// ========================================
// REGISTER
// ========================================

exports.register = async (req, res) => {
  try {
    const {
      fullName,
      name,
      email,
      phone,
      password,
    } = req.body || {};

    // -----------------------------
    // Validation
    // -----------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    const customerName =
      typeof fullName === "string"
        ? fullName.trim()
        : typeof name === "string"
        ? name.trim()
        : "";

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: "Full name is required",
      });
    }

    // -----------------------------
    // Check existing user
    // -----------------------------

    const existingUser = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // -----------------------------
    // Hash password
    // -----------------------------

    const hashedPassword = await bcrypt.hash(password, 12);

    // -----------------------------
    // Create user
    // -----------------------------

    const user = await User.create({
      name: customerName,
      phone: phone || null,
      email: normalizedEmail,
      password: hashedPassword,
    });

    // -----------------------------
    // Generate JWT
    // -----------------------------

    const token = generateToken(user);

    // -----------------------------
    // Safe user response
    // -----------------------------

    const userData = sanitizeUser(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    // Sequelize unique constraint
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to complete registration",
    });
  }
};

// ========================================
// LOGIN
// ========================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    // -----------------------------
    // Find user
    // -----------------------------

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    // Do NOT reveal whether email exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // -----------------------------
    // Compare password
    // -----------------------------

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // -----------------------------
    // Generate JWT
    // -----------------------------

    const token = generateToken(user);

    // -----------------------------
    // Safe response
    // -----------------------------

    const userData = sanitizeUser(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to login",
    });
  }
};

// ========================================
// GET CURRENT USER
// ========================================

exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findByPk(userId, {
      attributes: {
        exclude: [
          "password",
          "resetToken",
          "resetTokenExpire",
        ],
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("GET ME ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch user",
    });
  }
};

// ========================================
// FORGOT PASSWORD
// ========================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid email is required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    // Same response regardless of user existence
    const genericResponse = {
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent",
    };

    if (!normalizedEmail) {
      return res.status(200).json(genericResponse);
    }

    // -----------------------------
    // Find user
    // -----------------------------

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // -----------------------------
    // Generate secure reset token
    // -----------------------------

    const resetToken = crypto
      .randomBytes(32)
      .toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const expiry = new Date(
      Date.now() + 15 * 60 * 1000
    );

    // -----------------------------
    // Save hashed token
    // -----------------------------

    await user.update({
      resetToken: hashedToken,
      resetTokenExpire: expiry,
    });

    // -----------------------------
    // Production frontend URL
    // -----------------------------

    if (!process.env.FRONTEND_URL) {
      throw new Error(
        "FRONTEND_URL is not configured"
      );
    }

    const resetLink =
      `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // -----------------------------
    // Send email
    // -----------------------------

    /*
      IMPORTANT:
      Yahan aapka existing email service use karo.

      Example:

      await sendResetPasswordEmail(
        normalizedEmail,
        resetLink
      );
    */

    console.log(
      "Password reset email requested for:",
      normalizedEmail
    );

    // NEVER return resetToken/resetLink to frontend in production

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request",
    });
  }
};

// ========================================
// RESET PASSWORD
// ========================================

exports.resetPassword = async (req, res) => {
  try {
    const {
      token,
      password,
    } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password are required",
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long",
      });
    }

    // -----------------------------
    // Hash incoming token
    // -----------------------------

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // -----------------------------
    // Find user
    // -----------------------------

    const user = await User.findOne({
      where: {
        resetToken: hashedToken,
      },
    });

    // -----------------------------
    // Validate token
    // -----------------------------

    if (
      !user ||
      !user.resetTokenExpire ||
      new Date(user.resetTokenExpire) <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // -----------------------------
    // Hash new password
    // -----------------------------

    const hashedPassword =
      await bcrypt.hash(password, 12);

    // -----------------------------
    // Update password
    // -----------------------------

    await user.update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpire: null,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to reset password",
    });
  }
};