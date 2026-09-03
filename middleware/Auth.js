const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    // ==========================================
    // CHECK JWT SECRET
    // ==========================================
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is missing");

      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // ==========================================
    // GET AUTHORIZATION HEADER
    // ==========================================
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Authorization header missing",
      });
    }

    // ==========================================
    // CHECK BEARER FORMAT
    // ==========================================
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid authorization format",
      });
    }

    // ==========================================
    // EXTRACT TOKEN
    // ==========================================
    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Token missing",
      });
    }

    // ==========================================
    // VERIFY JWT
    // ==========================================
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // ==========================================
    // VALIDATE TOKEN PAYLOAD
    // ==========================================
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    // ==========================================
    // FIND USER
    // ==========================================
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // ==========================================
    // CHECK ACCOUNT STATUS
    // ==========================================
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // ==========================================
    // ATTACH SAFE USER DATA
    // ==========================================
    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: String(user.role || "USER").toUpperCase(),
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    };

    // ==========================================
    // CONTINUE
    // ==========================================
    return next();

  } catch (error) {

    // ==========================================
    // TOKEN EXPIRED
    // ==========================================
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    // ==========================================
    // INVALID TOKEN
    // ==========================================
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // ==========================================
    // OTHER AUTH ERRORS
    // ==========================================
    console.error("❌ AUTH MIDDLEWARE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

module.exports = authMiddleware;