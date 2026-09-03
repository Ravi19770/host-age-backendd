const service = require("../services/domian.service");

const parseJsonArray = (value, fallback = []) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      throw new Error("Expected an array");
    }

    return parsed;
  } catch {
    throw new Error("Invalid JSON array");
  }
};

exports.uploadDomain = async (req, res) => {
  try {
    const userId = req.user?.id;

    // =========================
    // AUTH CHECK
    // =========================
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // =========================
    // PARSE REQUEST DATA
    // =========================
    let domains;
    let businessEmails;

    try {
      domains = parseJsonArray(req.body?.domains);
      businessEmails = parseJsonArray(req.body?.businessEmails);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const domain = req.body?.domain;
    const zipFile = req.file;

    // =========================
    // DOMAIN / ZIP CHECK
    // =========================
    if ((!domain || !domain.trim()) && !zipFile) {
      return res.status(400).json({
        success: false,
        message: "Domain or ZIP file is required",
      });
    }

    // =========================
    // NORMALIZE DOMAIN
    // =========================
    const cleanDomain = domain
      ? domain.trim().toLowerCase()
      : null;

    // =========================
    // SERVICE CALL
    // =========================
    const result = await service.uploadDomain(
      userId,
      cleanDomain,
      zipFile,
      {
        domains,
        businessEmails,
        websiteSource: req.body?.websiteSource || null,
        websiteUrl: req.body?.websiteUrl || null,
        githubUrl: req.body?.githubUrl || null,
        pages: req.body?.pages || null,
      }
    );

    // =========================
    // SUCCESS
    // =========================
    return res.status(201).json({
      success: true,
      message: "Domain uploaded successfully",
      data: result,
    });
  } catch (error) {
    console.error("DOMAIN UPLOAD ERROR:", {
      message: error.message,
      userId: req.user?.id,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to upload domain",
    });
  }
};