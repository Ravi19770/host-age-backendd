const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");

router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "AI Route Working",
  });
});

router.post("/chat", aiController.chat);

module.exports = router;