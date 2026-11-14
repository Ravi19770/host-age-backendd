
const fs = require("fs");
const service = require("../services/domian.service");

const parseJsonArray = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    const error = new Error(`${fieldName} must be a valid JSON array`);
    error.status = 400;
    throw error;
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      throw new Error("Expected an array");
    }

    return parsed;
  } catch (_) {
    const error = new Error(`Invalid ${fieldName} JSON array`);
    error.status = 400;
    throw error;
  }
};

const getErrorStatus = (error) => {
  if (
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }

  if (
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
  ) {
    return error.statusCode;
  }

  const message = error.message || "";

  if (message === "Domain already exists") return 409;

  if (
    message.includes("Invalid domain") ||
    message.includes("Invalid ZIP") ||
    message.includes("ZIP file") ||
    message.includes("Domain is required") ||
    message.includes("Domain or ZIP")
  ) {
    return 400;
  }

  return 500;
};

exports.uploadDomain = async (req, res) => {
  const userId = req.user?.id;
  const zipFile = req.file;

  try {
    // Authentication check
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Domain validation
    const domain = req.body?.domain;

    if (
      !domain ||
      typeof domain !== "string" ||
      !domain.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Domain is required",
      });
    }

    // Parse multipart JSON fields
    const domains = parseJsonArray(
      req.body?.domains,
      "domains"
    );

    const businessEmails = parseJsonArray(
      req.body?.businessEmails,
      "businessEmails"
    );

    // ZIP validation
    if (!zipFile || !zipFile.path) {
      return res.status(400).json({
        success: false,
        message: "Website ZIP file is required",
      });
    }

    // Process website upload
    const result = await service.uploadDomain(
      userId,
      domain.trim().toLowerCase(),
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

    return res.status(201).json({
      success: true,
      message: "Website ZIP uploaded and validated",
      data: {
        id: result.id,
        domain: result.domain,
        status: result.status,
        hostingStatus: result.hostingStatus,
        websiteDeployment: result.websiteDeployment,
      },
    });
  } catch (error) {
    const status = getErrorStatus(error);

    console.error("DOMAIN UPLOAD ERROR:", {
      message: error.message,
      status,
      userId,
      domain: req.body?.domain || null,
    });

    return res.status(status).json({
      success: false,
      message:
        status >= 500
          ? "Failed to process website upload"
          : error.message,
    });
  } finally {
    // Remove temporary ZIP if it still exists.
    // If the service moved it to permanent storage,
    // this temporary path will no longer exist.
    if (zipFile?.path) {
      try {
        await fs.promises.unlink(zipFile.path);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error(
            "TEMP ZIP CLEANUP ERROR:",
            error.message
          );
        }
      }
    }
  }
};
