const renewalService = require("../services/renewal.service");

exports.getRenewal = async (req, res) => {
  try {
    const { id } = req.params;

    const renewal = await renewalService.getRenewal(
      id,
      req.user.id
    );

    return res.json({
      success: true,
      data: renewal,
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateRenewal = async (req, res) => {
  try {
    const { id } = req.params;

    const { autoRenew } = req.body;

    const renewal = await renewalService.updateRenewal(
      id,
      req.user.id,
      autoRenew
    );

    return res.json({
      success: true,
      message: "Auto Renewal Updated Successfully",
      data: renewal,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};