const express = require("express");
const router = express.Router();

const auth = require("../middleware/Auth");
const { getCvtplDomains } = require("../services/cvtpl.service");

router.get("/domains", auth, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result = await getCvtplDomains(userId);

    return res.status(200).json({
      success: true,
      cvtpl: result,
    });
  } catch (error) {
    console.error("CVTPL TEST ERROR:", {
      status: error.response?.status,
      message:
        error.response?.data?.message ||
        error.message,
    });

    return res.status(
      error.response?.status || 500
    ).json({
      success: false,
      message:
        error.response?.data?.message ||
        "CVTPL API request failed",
    });
  }
});

module.exports = router;