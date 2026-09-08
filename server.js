require("dns").setDefaultResultOrder("ipv4first");

const path = require("path");






require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const { Resend } = require("resend");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("./middleware/Auth.js");
const role = require("./middleware/role.middleware.js");
const adminRoutes = require("./routes/admin.routes.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const emailRoutes = require("./routes/email.routes"); // ya jo bhi file name hai
const EmailPage = require("./models/EmailPage");
const aiRoutes = require("./routes/ai.routes");
const ticketRoutes = require("./routes/ticket/ticket.routes.js");


const { sequelize, connectDB } = require("./config/db");
const User = require("./models/User");
const Domain = require("./models/domains/domains.model.js");
const multer = require("multer");
const crawlWebsite = require("./services/crawler.js");
const { moderateContent } = require("./models/domains/contentModeration.service.js");



const extractText = require("./services/htmlExtractor.js")
const domainRoutes = require("./routes/domain.routes.js");
const { createLead } = require("./services/bitrix.service.js");






const {  sendOTPEmail,  sendResetPasswordEmail,} = require("./services/emailServices");

const app = express();

/* ================= MIDDLEWARE ================= */

const allowedOrigins = [
  "https://host-age.in",
  "https://www.host-age.in",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Server-to-server / curl requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ CORS BLOCKED:", origin);
      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    optionsSuccessStatus: 204,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/ai", aiRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", authMiddleware, role("ADMIN"), adminRoutes);
console.log("✅ ticket.routes.js loaded");
console.log("✅ admin.routes.js loaded");

app.use("/api/email-pages", emailRoutes);

console.log("✅ email.routes.js loaded");
/* ================= IN-MEMORY DB ================= */

const users = []; // 
const otpStore = {};

/* ================= RATE LIMIT ================= */

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many OTP requests. Try again later.",
  },
});

/* ================= UTIL ================= */

const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/* ================= HEALTH CHECK ================= */

// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Host-Age Backend Running",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "operational",
    service: "Host-Age Backend",
    timestamp: new Date().toISOString(),
  });
});

/* ================= SEND OTP ================= */

app.post("/api/send-email-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    };

    console.log("OTP:", otp);

    await sendOTPEmail(email, otp);

    return res.json({
      success: true,
      message: "OTP sent",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* ================= VERIFY OTP ================= */

/* ================= VERIFY EMAIL OTP ================= */

app.post("/api/verify-email-otp", (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const submittedOtp = String(otp).trim();

    const record = otpStore[normalizedEmail];

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or expired",
      });
    }

    /* ---------- EXPIRY CHECK ---------- */

    if (Date.now() > record.expiresAt) {
      delete otpStore[normalizedEmail];

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    /* ---------- ATTEMPT LIMIT ---------- */

    if (record.attempts >= 5) {
      delete otpStore[normalizedEmail];

      return res.status(429).json({
        success: false,
        message: "Too many invalid OTP attempts. Please request a new OTP.",
      });
    }

    /* ---------- OTP CHECK ---------- */

    if (submittedOtp !== String(record.otp)) {
      record.attempts += 1;

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        attemptsRemaining: Math.max(0, 5 - record.attempts),
      });
    }

    /* ---------- SUCCESS ---------- */

    delete otpStore[normalizedEmail];

    return res.json({
      success: true,
      message: "OTP verified",
    });

  } catch (err) {
    

    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
});

/* ================= REGISTER ================= */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // =========================
    // VALIDATION
    // =========================
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is missing");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // =========================
    // CHECK EXISTING USER
    // =========================
    const existingUser = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // =========================
    // HASH PASSWORD
    // =========================
    const hashedPassword = await bcrypt.hash(password, 12);

    // =========================
    // CREATE USER
    // =========================
    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : null,
      password: hashedPassword,
    });

    // =========================
    // GENERATE JWT
    // =========================
    const token = jwt.sign(
      {
        id: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // =========================
    // RESPONSE
    // =========================
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("❌ Registration Error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});
//login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // =========================
    // VALIDATION
    // =========================
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // =========================
    // FIND USER
    // =========================
    const user = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    // Don't reveal whether email exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // =========================
    // CHECK ACCOUNT STATUS
    // =========================
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // =========================
    // CHECK PASSWORD
    // =========================
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // =========================
    // UPDATE LAST LOGIN
    // =========================
    await user.update({
      lastLogin: new Date(),
    });

    // =========================
    // GENERATE JWT
    // =========================
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is missing");

      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // =========================
    // SAFE USER RESPONSE
    // =========================
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("❌ LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
  

});



/* ================= CURRENT USER ================= */
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password", "resetToken", "resetTokenExpire"] },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error("GET ME ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch user" });
  }
});

/* ================= LOGOUT ================= */
app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  return res.json({ success: true, message: "Logged out successfully" });
});

/* ================= PROFILE ================= */
app.put("/api/auth/profile", authMiddleware, async (req, res) => {
  try {
    const { fullName, phone } = req.body || {};
    const user = await User.findByPk(req.user.id);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ success: false, message: "Full name is required" });
    }

    await user.update({
      fullName: String(fullName).trim(),
      phone: phone ? String(phone).trim() : null,
    });

    const safeUser = user.toJSON();
    delete safeUser.password;
    delete safeUser.resetToken;
    delete safeUser.resetTokenExpire;

    return res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update profile" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      where: { email: normalizedEmail },
    });

    // Security: same response even if user doesn't exist
    if (!user) {
      return res.json({
        success: true,
        message: "If email exists, reset link sent",
      });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Save token in DB
    user.resetToken = hashedToken;
    user.resetTokenExpire = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await user.save();

    // Frontend reset link
    const resetLink =
      `http://localhost:3000/reset-password/${resetToken}`;

    // SEND EMAIL
    await sendResetPasswordEmail(
      normalizedEmail,
      resetLink
    );

    

   

    return res.json({
      success: true,
      message: "Reset link sent to email",
    });

  } catch (err) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password required",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      where: { resetToken: hashedToken },
    });

    if (
      !user ||
      !user.resetTokenExpire ||
      new Date(user.resetTokenExpire) < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpire = null;

    await user.save();

    return res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
/* ================= CLEANUP OTP ================= */

setInterval(() => {
  const now = Date.now();

  for (const email in otpStore) {
    if (otpStore[email]?.expiresAt < now) {
      delete otpStore[email];
    }
  }
}, 60000);

const domainUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== "websiteFile") {
      return cb(null, false);
    }
    if (file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed") {
      return cb(null, true);
    }
    return cb(new Error("Only ZIP website files are allowed"));
  },
});

app.post("/api/domains/upload", authMiddleware, domainUpload.single("websiteFile"), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const rawDomain = req.body?.domain || (req.body?.domains ? JSON.parse(req.body.domains)[0] : null);
    const domain = typeof rawDomain === "string" ? rawDomain.trim().toLowerCase() : rawDomain;
    if (!domain) return res.status(400).json({ success: false, message: "Domain is required" });

    if (req.body?.websiteSource === "url" && !req.body?.websiteUrl) {
      return res.status(400).json({ success: false, message: "Website URL is required" });
    }
    if (req.body?.websiteSource === "github" && !req.body?.githubUrl) {
      return res.status(400).json({ success: false, message: "GitHub URL is required" });
    }
    if ((req.body?.websiteSource === "upload" || req.body?.websiteSource === "zip") && !req.file) {
      return res.status(400).json({ success: false, message: "ZIP file is required" });
    }

    const service = require("./services/domian.service");
    const parseArray = (value) => {
      if (!value) return [];
      try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    };

    const result = await service.uploadDomain(userId, domain, req.file, {
      domains: parseArray(req.body?.domains),
      businessEmails: parseArray(req.body?.businessEmails),
      websiteSource: req.body?.websiteSource || null,
      websiteUrl: req.body?.websiteUrl || null,
      githubUrl: req.body?.githubUrl || null,
      pages: req.body?.pages || null,
      termsAccepted: req.body?.termsAccepted === "true",
      plan: req.body?.plan || null,
    });

    return res.status(201).json({ success: true, message: "Domain uploaded successfully", data: result });
  } catch (error) {
    console.error("DOMAIN UPLOAD ERROR:", error);
    const status = /already exists/i.test(error.message) ? 409 : /invalid domain/i.test(error.message) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to upload domain" });
  }
});

app.get("/api/domains", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const domains = await Domain.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      data: domains,
    });

  } catch (error) {
    console.error("GET DOMAINS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
    
  }
  
});


app.get("/api/health", async (req, res) => {
  try {
    res.status(200).json({
      status: "operational",
      services: {
        hosting: "operational",
        email: "operational",
        security: "operational",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      status: "down",
      services: {
        hosting: "down",
        email: "down",
        security: "down",
      },
    });
  }
});


/* ================= START SERVER ================= */
const PORT = Number(process.env.PORT) || 5200;

console.log("======================================");
console.log("🔧 STARTING HOST-AGE SERVER");
console.log("📌 PORT:", PORT);
console.log("📌 NODE:", process.version);
console.log("📌 PID:", process.pid);
console.log("======================================");

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("======================================");
    console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log("======================================");
});
server.on("listening", () => {
  const address = server.address();

  console.log("======================================");
  console.log("✅ SERVER LISTENING");
  console.log("📡 Address:", address);
  console.log("======================================");
});

server.on("error", (error) => {
  console.error("======================================");
  console.error("❌ SERVER ERROR");
  console.error("Code:", error.code);
  console.error("Message:", error.message);
  console.error(error);
  console.error("======================================");
});

server.on("close", () => {
  console.error("⚠️ HTTP SERVER CLOSED");
});

process.on("uncaughtException", (error) => {
  console.error("======================================");
  console.error("❌ UNCAUGHT EXCEPTION");
  console.error(error);
  console.error("======================================");
});

process.on("unhandledRejection", (reason) => {
  console.error("======================================");
  console.error("❌ UNHANDLED REJECTION");
  console.error(reason);
  console.error("======================================");
});

process.on("beforeExit", (code) => {
  console.error("⚠️ NODE BEFORE EXIT");
  console.error("Exit Code:", code);
});

process.on("exit", (code) => {
  console.error("⚠️ NODE PROCESS EXITED");
  console.error("Exit Code:", code);
});

process.on("SIGINT", () => {
  console.error("⚠️ SIGINT RECEIVED");
});

process.on("SIGTERM", () => {
  console.error("⚠️ SIGTERM RECEIVED");
});

process.on("SIGHUP", () => {
  console.error("⚠️ SIGHUP RECEIVED");
});

// Temporary heartbeat - server alive check
setInterval(() => {
  console.log("💓 HOST-AGE SERVER ALIVE:", new Date().toISOString());
}, 10000);