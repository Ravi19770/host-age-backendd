
const Domain = require("../models/domains/domains.model");
const { verifyDomainDns } = require("../services/dnsVerification.service");

exports.verifyDns = async (req, res) => {
  try {
    const userId =
      req.user?.id ||
      req.user?.userId ||
      req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const domainRecord = await Domain.findOne({
      where: {
        id: req.params.id,
        userId,
      },
    });

    if (!domainRecord) {
      return res.status(404).json({
        success: false,
        message: "Domain not found",
      });
    }

    if (domainRecord.status === "rejected") {
      return res.status(409).json({
        success: false,
        message: "This domain was rejected and cannot be verified",
      });
    }

    const result = await verifyDomainDns(domainRecord);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("DNS verification error:", error);

    return res.status(500).json({
      success: false,
      message: "DNS verification could not be completed",
    });
  }
};
