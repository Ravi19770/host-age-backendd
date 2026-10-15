const crypto = require("crypto");
const Domain = require("../models/domains/domains.model");
const User = require("../models/User");

const crawlWebsite = require("./crawler.js");
const { validateDomain } = require("../models/domains/domains.validation");
const detectTechnology = require("../models/domains/technologyDetector");
const { moderateContent } = require("../models/domains/contentModeration.service");
const extractText = require("./htmlExtractor");
const { createLead } = require("./bitrix.service");

const normalizeDomain = (domain) => {
  if (!domain) return null;

  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
};

exports.uploadDomain = async (userId, domain, zipFile, metadata = {}) => {
  if (!userId) {
    throw new Error("UserId is required");
  }

  if (!domain && !zipFile) {
    throw new Error("Domain or ZIP file is required");
  }

  // =====================================
  // ZIP FLOW
  // =====================================

  if (!domain && zipFile) {
    throw new Error("Domain is required for website upload");
  }

  // =====================================
  // NORMALIZE + VALIDATE
  // =====================================

  const cleanDomain = normalizeDomain(domain);

  if (!cleanDomain || !validateDomain(cleanDomain)) {
    throw new Error("Invalid domain format");
  }

  // =====================================
  // DUPLICATE CHECK
  // =====================================

  const existing = await Domain.findOne({
    where: {
      domain: cleanDomain,
    },
  });

  if (existing) {
    throw new Error("Domain already exists");
  }

  // =====================================
  // TOKEN
  // =====================================

  const verificationToken = crypto
    .randomBytes(32)
    .toString("hex");

  // =====================================
  // CRAWL
  // =====================================

  let websiteContent = {
    html: "",
    status: "failed",
  };

  let websiteText = "";
  let technology = {};

  const moderationFlags = {
    adult: false,
    hateSpeech: false,
    gambling: false,
    drugs: false,
  };

  if (cleanDomain) {
    try {
      websiteContent = await crawlWebsite(cleanDomain);

      if (websiteContent?.html) {
        websiteText = extractText(
          websiteContent.html
        );

        technology =
          await detectTechnology(cleanDomain);

        Object.assign(
          moderationFlags,
          moderateContent(websiteText)
        );
      }
    } catch (error) {
      console.error(
        "Domain processing failed:",
        error.message
      );

      websiteContent = {
        html: "",
        status: "failed",
      };
    }
  }

  // =====================================
  // MODERATION
  // =====================================

  const isUnsafe =
    moderationFlags.adult ||
    moderationFlags.hateSpeech ||
    moderationFlags.gambling ||
    moderationFlags.drugs;

  let status = "pending";

  if (isUnsafe) {
    status = "rejected";
  } else if (
    websiteContent.status === "success"
  ) {
    status = "verified";
  }

  // =====================================
  // DATABASE
  // =====================================

  let created;

  try {
    created = await Domain.create({
      userId,
      domain: cleanDomain,
      verificationToken,
      verified: status === "verified",
      status,

      technology,

      moderation: {
        status: isUnsafe
          ? "blocked"
          : status === "verified"
          ? "safe"
          : "review",

        flags: moderationFlags,

        flaggedAt: isUnsafe
          ? new Date()
          : null,
      },

      crawler: {
        lastCrawledAt:
          websiteContent.html
            ? new Date()
            : null,

        crawlStatus:
          websiteContent.status === "failed"
            ? "failed"
            : "success",

        score:
          status === "verified"
            ? 100
            : 0,

        issues: isUnsafe
          ? Object.keys(
              moderationFlags
            ).filter(
              (key) =>
                moderationFlags[key]
            )
          : [],
      },
    });
  } catch (error) {
    console.error(
      "DOMAIN CREATE ERROR:",
      error.message
    );

    throw error;
  }

  // =====================================
  // BITRIX
  // =====================================

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
    console.error(
      "Bitrix sync failed:",
      error.message
    );
  }

  // =====================================
  // RESPONSE
  // =====================================

  return {
    id: created.id,
    success: true,
    domain: created.domain,
    status: created.status,
    technology,
    moderation: moderationFlags,
    crawlStatus:
      websiteContent.status,
  };
};