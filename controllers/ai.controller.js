const aiService = require("../services/ai.service");

exports.chat = async (req, res) => {
  try {
    const { message } = req.body;

    const reply = await aiService.chat(message);

    res.json({
      success: true,
      reply,
    });

  } catch (err) {
    console.error("AI ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};