const express = require("express");
const router = express.Router();
const auth = require("../controllers/auth.Controllers");
const authMiddleware = require("../middleware/Auth.js");

router.post("/register", auth.register);
router.post("/login", auth.login);
router.get("/me", authMiddleware, auth.getMe);
router.post("/forgot-password", auth.forgotPassword);
router.post("/reset-password", auth.resetPassword);

router.post("/logout", authMiddleware, (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

module.exports = router;
