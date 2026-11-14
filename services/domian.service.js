
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const Domain = require("../models/domains/domains.model");
const User = require("../models/User");

const crawlWebsite = require("./crawler.js");
const { validateDomain } = require("../models/domains/domains.validation");
const detectTechnology = require("../models/domains/technologyDetector");
const {
  moderateContent,
} = require("../models/domains/contentModeration.service");
const extractText = require("./htmlExtractor");
const { createLead } = require("./bitrix.service");
const cvtplService = require("./cvtpl.service");

const {
  extractWebsiteZip,
  validateWebsiteRoot,
} = require("./websiteZip.service");

const WEBSITE_STORAGE_DIR =
  process.env.WEBSITE_STORAGE_DIR ||
  path.join(process.cwd(), "storage", "websites");

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeDomain(domain) {
  if (!domain || typeof domain !== "string") {
    return null;
  }

  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
.replace(/^www\./, "")
.replace(/\/+$/, "");
}

async function moveFile(source, destination) {
  await fs.promises.mkdir(path.dirname(destination), {
    recursive: true,
    mode: 0o750,
  });

  try {
    await fs.promises.rename(source, destination);
  } catch (error) {
    if (error.code !== "EXDEV") {
      throw error;
    }

    await fs.promises.copyFile(source, destination);
    await fs.promises.unlink(source);
  }
}

async function removeDirectory(target) {
  if (!target) return;

  try {
    await fs.promises.rm(target, {
      recursive: true,
      force: true,
    });
  } catch (error) {
    console.error("Storage cleanup failed:", error.message);
  }
}

function getWebsiteDeployment(domainRecord) {
  return domainRecord.get("websiteDeployment") || {};
}

exports.uploadDomain = async (
  userId,
  domain,
  zipFile,
  metadata = {}
) => {
  if (!userId) {
    throw createError("UserId is required", 401);
  }

  if (!domain) {
    throw createError("Domain is required", 400);
  }

  if (!zipFile?.path) {
    throw createError("Website ZIP file is required", 400);
  }

  const cleanDomain = normalizeDomain(domain);

  if (!cleanDomain || !validateDomain(cleanDomain)) {
    throw createError("Invalid domain format", 400);
  }

  // Check duplicate domain
  const existing = await Domain.findOne({
    where: {
      domain: cleanDomain,
    },
  });

  if (existing) {
    throw createError("Domain already exists", 409);
  }

  const operationId = crypto.randomUUID();
  const verificationToken = crypto.randomBytes(32).toString("hex");

  const domainStorage = path.join(
    WEBSITE_STORAGE_DIR,
    String(userId),
    operationId
  );

  const archivePath = path.join(domainStorage, "website.zip");
  const extractedPath = path.join(domainStorage, "site");

  let created = null;

  try {
    // Create isolated storage directory
    await fs.promises.mkdir(domainStorage, {
      recursive: true,
      mode: 0o750,
    });

    // Move temporary uploaded ZIP into permanent storage
    await moveFile(zipFile.path, archivePath);

    // Extract ZIP with archive safety limits
    const extraction = await extractWebsiteZip(
      archivePath,
      extractedPath
    );

    // Verify website contains a valid root index.html
    const indexPath = await validateWebsiteRoot(extractedPath);

    const indexHtml = await fs.promises.readFile(
      indexPath,
      "utf8"
    );

    const uploadedText = extractText(indexHtml);

    // Existing live-domain crawl
    let websiteContent = {
      html: "",
      status: "failed",
    };

    let technology = {};

    try {
      websiteContent = await crawlWebsite(cleanDomain);

      if (websiteContent?.html) {
        technology = await detectTechnology(cleanDomain);
      }
    } catch (error) {
      console.error("Domain crawl failed:", error.message);
    }

    // Moderate uploaded website's root index.html text
    const moderationFlags = {
      adult: false,
      hateSpeech: false,
      gambling: false,
      drugs: false,
    };

    Object.assign(
      moderationFlags,
      moderateContent(uploadedText) || {}
    );

    const isUnsafe = Object.values(moderationFlags).some(
      Boolean
    );

    const initialStatus = isUnsafe ? "rejected" : "pending";

    // Create database record
    created = await Domain.create({
      userId,
      domain: cleanDomain,
      verificationToken,
      verified: false,
      status: initialStatus,

      technology,

      moderation: {
        status: isUnsafe ? "blocked" : "review",
        flags: moderationFlags,
        reason: isUnsafe
          ? "Uploaded website content failed moderation"
          : null,
        flaggedAt: isUnsafe ? new Date() : null,
      },

      crawler: {
        lastCrawledAt: websiteContent?.html
          ? new Date()
          : null,
        crawlStatus: websiteContent?.status || "failed",
        score: 0,
        issues: isUnsafe
          ? Object.keys(moderationFlags).filter(
              (key) => moderationFlags[key]
            )
          : [],
      },

      websiteDeployment: {
        uploadStatus: "uploaded",
        originalFileName: path.basename(
          zipFile.originalname || "website.zip"
        ),
        fileSize: Number(zipFile.size || 0),
        storagePath: archivePath,
        extractionStatus: "completed",
        extractedPath,
        deploymentStatus: "not_started",
        deploymentId: operationId,
        deployedAt: null,
        lastError: null,
        extractedFileCount: extraction.fileCount,
        extractedBytes: extraction.extractedBytes,
      },
    });

    // CVTPL domain provisioning
    let cvtplData = {
      provisioned: false,
      status: "pending",
      requestId: `host-age-domain-${created.id}`,
      cvtplDomainId: null,
      dns: null,
      lastError: null,
      provisionedAt: null,
    };

    let hostingStatus = "pending";

    if (isUnsafe) {
      cvtplData.status = "blocked";
      cvtplData.lastError =
        "Domain rejected by content moderation";

      hostingStatus = "failed";
    } else {
      try {
        if (!process.env.CVTPL_API_KEY) {
          throw new Error(
            "CVTPL_API_KEY is not configured"
          );
        }

        const user = await User.findByPk(userId);

        const providerResponse =
          await cvtplService.createCvtplDomain({
            userId,
            domain: created.domain,
            customer: {
              name:
                user?.fullName ||
                user?.name ||
                "Host-Age Customer",
              email: user?.email || null,
            },
            type: "addon",
            requestId: `host-age-domain-${created.id}`,
          });

        const providerData = providerResponse?.data || {};

        const providerStatus = String(
          providerData.status ||
            providerData.domain?.status ||
            providerData.data?.status ||
            ""
        )
          .trim()
          .toLowerCase();

        const active = ["active", "deployed"].includes(
          providerStatus
        );

        cvtplData = {
          provisioned: true,
          status: active ? providerStatus : "pending",
          requestId: `host-age-domain-${created.id}`,
          cvtplDomainId:
            providerData.domain_id ||
            providerData.domain?.id ||
            providerData.id ||
            null,
          dns:
            providerData.dns ||
            providerData.domain?.dns ||
            null,
          lastError: null,
          provisionedAt: new Date(),
        };

        hostingStatus = active ? providerStatus : "pending";
      } catch (error) {
        console.error("CVTPL PROVISIONING ERROR:", {
          domain: created.domain,
          message: error.message,
          status: error.status || null,
        });

        cvtplData = {
          ...cvtplData,
          status: "failed",
          provisioned: false,
          lastError: error.message,
        };

        hostingStatus = "failed";
      }
    }

    await created.update({
      cvtpl: cvtplData,
    });

    // Website deployment is not started because
    // a confirmed CVTPL ZIP deployment API is not available.
    const deployment = {
      ...getWebsiteDeployment(created),
      deploymentStatus: "not_started",
      lastError: isUnsafe
        ? "Website rejected by content moderation"
        : "CVTPL website deployment API is not configured",
    };

    await created.update({
      websiteDeployment: deployment,
    });

    // Preserve existing Bitrix lead creation
    try {
      const user = await User.findByPk(userId);

      if (user) {
        await createLead({
          domain: created.domain,
          name:
            user.fullName ||
            user.name ||
            "Host-Age User",
          email: user.email || null,
          phone: user.phone || null,
        });
      }
    } catch (error) {
      console.error("Bitrix sync failed:", error.message);
    }

    return {
      id: created.id,
      success: true,
      domain: created.domain,
      status: created.status,
      hostingStatus,
      websiteDeployment: getWebsiteDeployment(created),
      cvtpl: cvtplData,
      technology,
      moderation: moderationFlags,
      crawlStatus: websiteContent.status,
    };
  } catch (error) {
    // If the database record exists, preserve the uploaded
    // website and record the processing error.
    if (created) {
      try {
        const currentDeployment =
          getWebsiteDeployment(created);

        await created.update({
          websiteDeployment: {
            ...currentDeployment,
            lastError: error.message,
          },
        });
      } catch (updateError) {
        console.error(
          "Could not update website deployment error:",
          updateError.message
        );
      }
    } else {
      // No database record was created, so remove partial files.
      await removeDirectory(domainStorage);
    }

    throw error;
  }
};
