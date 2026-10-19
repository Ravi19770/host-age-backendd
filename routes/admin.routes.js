const express = require("express");
const { Op } = require("sequelize");
const {
  User,
  Domain,
  EmailPage,
  Ticket,
  TicketMessage,
  TicketAttachment,
  TicketHistory,
  TicketInternalNote,
  Plan,
  Payment,
  Subscription,
  AuditLog,
} = require("../models");
const cvtplService = require("../services/cvtpl.service");
const crawlWebsite = require("../services/crawler");
const detectTechnology = require("../models/domains/technologyDetector");
const { moderateContent } = require("../models/domains/contentModeration.service");
const extractText = require("../services/htmlExtractor");
const { encryptToken } = require("../utils/cvtplTokenCrypto");

const router = express.Router();

/* ==========================================================================
   1. ADMIN AUTH & SELF VERIFICATION
   ========================================================================== */

/**
 * GET /api/admin/me
 * Verify authenticated admin account
 */
router.get("/me", async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password", "resetToken", "resetTokenExpire"] },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Admin user not found" });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error("ADMIN ME ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==========================================================================
   2. DASHBOARD OVERVIEW & STATISTICS
   ========================================================================== */

/**
 * GET /api/admin/dashboard
 * Aggregated live metrics from PostgreSQL
 */
router.get("/dashboard", async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalAdmins,
      totalDomains,
      verifiedDomains,
      pendingDomains,
      rejectedDomains,
      suspendedDomains,
      totalTickets,
      openTickets,
      pendingTickets,
      resolvedTickets,
      closedTickets,
      totalEmails,
      activeEmails,
      pendingEmails,
      failedEmails,
      totalPayments,
      totalSubscriptions,
      recentUsers,
      recentDomains,
      recentTickets,
      plansList,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { isActive: true } }),
      User.count({ where: { isActive: false } }),
      User.count({ where: { role: "ADMIN" } }),
      Domain.count(),
      Domain.count({ where: { status: "verified" } }),
      Domain.count({ where: { status: "pending" } }),
      Domain.count({ where: { status: "rejected" } }),
      Domain.count({ where: { status: "suspended" } }),
      Ticket.count(),
      Ticket.count({ where: { status: "Open" } }),
      Ticket.count({ where: { status: "Pending" } }),
      Ticket.count({ where: { status: "Resolved" } }),
      Ticket.count({ where: { status: "Closed" } }),
      EmailPage.count(),
      EmailPage.count({ where: { status: "active" } }),
      EmailPage.count({ where: { status: "pending" } }),
      EmailPage.count({ where: { status: "failed" } }),
      Payment.count().catch(() => 0),
      Subscription.count().catch(() => 0),
      User.findAll({
        attributes: { exclude: ["password", "resetToken", "resetTokenExpire"] },
        order: [["createdAt", "DESC"]],
        limit: 5,
      }),
      Domain.findAll({
        include: [{ model: User, as: "user", attributes: ["id", "fullName", "email"] }],
        order: [["createdAt", "DESC"]],
        limit: 5,
      }),
      Ticket.findAll({
        include: [{ model: User, as: "user", attributes: ["id", "fullName", "email"] }],
        order: [["createdAt", "DESC"]],
        limit: 5,
      }),
      Plan.findAll({ order: [["price", "ASC"]] }).catch(() => []),
    ]);

    // Sum total payment revenue if payments table has records
    let totalRevenue = 0;
    try {
      const revenueResult = await Payment.sum("amount", { where: { status: "SUCCESS" } });
      totalRevenue = Number(revenueResult) || 0;
    } catch (_) {
      totalRevenue = 0;
    }

    return res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          admins: totalAdmins,
        },
        domains: {
          total: totalDomains,
          verified: verifiedDomains,
          pending: pendingDomains,
          rejected: rejectedDomains,
          suspended: suspendedDomains,
        },
        tickets: {
          total: totalTickets,
          open: openTickets,
          pending: pendingTickets,
          resolved: resolvedTickets,
          closed: closedTickets,
        },
        emails: {
          total: totalEmails,
          active: activeEmails,
          pending: pendingEmails,
          failed: failedEmails,
        },
        billing: {
          totalPayments,
          totalSubscriptions,
          totalRevenue,
        },
      },
      recentUsers,
      recentDomains,
      recentTickets,
      plans: plansList,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to generate dashboard metrics" });
  }
});

/**
 * GET /api/admin/stats
 * Backward-compatible stats endpoint
 */
router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, totalAdmins, activeUsers, inactiveUsers] = await Promise.all([
      User.count(),
      User.count({ where: { role: "ADMIN" } }),
      User.count({ where: { isActive: true } }),
      User.count({ where: { isActive: false } }),
    ]);

    return res.json({
      success: true,
      stats: { totalUsers, totalAdmins, activeUsers, inactiveUsers },
    });
  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch admin statistics" });
  }
});

/* ==========================================================================
   3. USER MANAGEMENT
   ========================================================================== */

/**
 * GET /api/admin/users
 * Search, filter, pagination
 */
router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const roleFilter = (req.query.role || "").trim().toUpperCase();
    const statusFilter = req.query.status;

    const where = {};

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (roleFilter && ["USER", "ADMIN"].includes(roleFilter)) {
      where.role = roleFilter;
    }

    if (statusFilter === "active") {
      where.isActive = true;
    } else if (statusFilter === "inactive") {
      where.isActive = false;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password", "resetToken", "resetTokenExpire"] },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Attach count of domains per user
    const userIds = users.map((u) => u.id);
    const domainCounts = await Domain.findAll({
      attributes: ["userId", [Domain.sequelize.fn("COUNT", Domain.sequelize.col("id")), "domainCount"]],
      where: { userId: { [Op.in]: userIds } },
      group: ["userId"],
      raw: true,
    });

    const domainCountMap = {};
    domainCounts.forEach((d) => {
      domainCountMap[d.userId] = parseInt(d.domainCount, 10) || 0;
    });

    const enrichedUsers = users.map((u) => {
      const plain = u.toJSON();
      plain.domainsCount = domainCountMap[u.id] || 0;
      return plain;
    });

    return res.json({
      success: true,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      users: enrichedUsers,
    });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch users" });
  }
});

/**
 * GET /api/admin/users/:id
 * Individual user details with associated resources
 */
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password", "resetToken", "resetTokenExpire"] },
      include: [
        { model: Domain, as: "domains" },
        { model: EmailPage, as: "emailPages" },
        { model: Ticket, as: "tickets", limit: 10, order: [["createdAt", "DESC"]] },
      ],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Also fetch any subscriptions
    const subscriptions = await Subscription.findAll({
      where: { userId: user.id },
      order: [["createdAt", "DESC"]],
    }).catch(() => []);

    // Also fetch any payments by user email
    const payments = await Payment.findAll({
      where: { email: user.email },
      order: [["createdAt", "DESC"]],
      limit: 10,
    }).catch(() => []);

    const userObj = user.toJSON();
    userObj.subscriptions = subscriptions;
    userObj.payments = payments;

    return res.json({ success: true, user: userObj });
  } catch (error) {
    console.error("ADMIN GET USER ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch user details" });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update permitted user info (name, phone, role)
 */
router.patch("/users/:id", async (req, res) => {
  try {
    const { fullName, phone, role: newRole } = req.body || {};
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updates = {};
    if (typeof fullName === "string" && fullName.trim().length >= 2) {
      updates.fullName = fullName.trim();
    }
    if (typeof phone === "string") {
      updates.phone = phone.trim() || null;
    }
    if (newRole && ["USER", "ADMIN"].includes(newRole.toUpperCase())) {
      // Prevent removing admin role from own account
      if (req.params.id === req.user.id && newRole.toUpperCase() !== "ADMIN") {
        return res.status(400).json({
          success: false,
          message: "You cannot revoke admin privileges from your own account",
        });
      }
      updates.role = newRole.toUpperCase();
    }

    await user.update(updates);

    await AuditLog.log({
      action: "USER_UPDATED",
      entity: "User",
      entityId: user.id,
      userId: req.user.id,
      payload: { updates, targetEmail: user.email },
    });

    return res.json({
      success: true,
      message: "User information updated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("ADMIN UPDATE USER ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update user" });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Activate or suspend account
 */
router.patch("/users/:id/status", async (req, res) => {
  try {
    const { isActive } = req.body || {};

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive must be a boolean" });
    }

    if (req.params.id === req.user.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own admin account",
      });
    }

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await user.update({ isActive });

    await AuditLog.log({
      action: isActive ? "USER_ACTIVATED" : "USER_SUSPENDED",
      entity: "User",
      entityId: user.id,
      userId: req.user.id,
      payload: { isActive, targetEmail: user.email },
    });

    return res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("ADMIN USER STATUS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update user status" });
  }
});

/**
 * POST /api/admin/promote
 * Securely promote an existing user to ADMIN
 */
router.post("/promote", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User with this email not found" });
    }

    await user.update({ role: "ADMIN" });

    await AuditLog.log({
      action: "USER_PROMOTED_ADMIN",
      entity: "User",
      entityId: user.id,
      userId: req.user.id,
      payload: { email: user.email },
    });

    return res.json({
      success: true,
      message: `User ${user.email} promoted to ADMIN successfully`,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("ADMIN PROMOTE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to promote user" });
  }
});

/* ==========================================================================
   4. DOMAIN AND WEBSITE MANAGEMENT
   ========================================================================== */

/**
 * GET /api/admin/domains
 * List all domains with owner, search, status filter, pagination
 */
router.get("/domains", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const statusFilter = (req.query.status || "").trim().toLowerCase();

    const where = {};

    if (search) {
      where.domain = { [Op.iLike]: `%${search}%` };
    }

    if (statusFilter && ["pending", "verified", "rejected", "suspended"].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const { count, rows: domains } = await Domain.findAndCountAll({
      where,
      include: [{ model: User, as: "user", attributes: ["id", "fullName", "email", "phone"] }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      domains,
    });
  } catch (error) {
    console.error("ADMIN DOMAINS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch domains" });
  }
});

/**
 * GET /api/admin/domains/:id
 * Single domain with diagnostics, crawler, CVTPL status
 */
router.get("/domains/:id", async (req, res) => {
  try {
    const domain = await Domain.findByPk(req.params.id, {
      include: [{ model: User, as: "user", attributes: ["id", "fullName", "email", "phone"] }],
    });

    if (!domain) {
      return res.status(404).json({ success: false, message: "Domain record not found" });
    }

    return res.json({ success: true, domain });
  } catch (error) {
    console.error("ADMIN GET DOMAIN ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch domain details" });
  }
});

/**
 * PATCH /api/admin/domains/:id/status
 * Admin manual approve/reject/suspend
 */
router.patch("/domains/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ["pending", "verified", "rejected", "suspended"];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(", ")}`,
      });
    }

    const domain = await Domain.findByPk(req.params.id);
    if (!domain) {
      return res.status(404).json({ success: false, message: "Domain not found" });
    }

    const oldStatus = domain.status;
    await domain.update({
      status,
      verified: status === "verified",
    });

    await AuditLog.log({
      action: "DOMAIN_STATUS_UPDATED",
      entity: "Domain",
      entityId: domain.id,
      userId: req.user.id,
      payload: { domain: domain.domain, oldStatus, newStatus: status },
    });

    return res.json({
      success: true,
      message: `Domain ${domain.domain} status updated to ${status}`,
      domain,
    });
  } catch (error) {
    console.error("ADMIN DOMAIN STATUS UPDATE ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update domain status" });
  }
});

/**
 * POST /api/admin/domains/:id/retry
 * Retry website crawl, moderation, or CVTPL provisioning
 */
router.post("/domains/:id/retry", async (req, res) => {
  try {
    const domain = await Domain.findByPk(req.params.id, {
      include: [{ model: User, as: "user", attributes: ["id", "fullName", "email"] }],
    });

    if (!domain) {
      return res.status(404).json({ success: false, message: "Domain not found" });
    }

    let crawlResult = { status: "skipped" };
    let technology = domain.technology || {};
    let moderationFlags = domain.moderation?.flags || {};
    let isUnsafe = false;

    // 1. Re-crawl & Moderation
    try {
      const crawlRes = await crawlWebsite(domain.domain);
      if (crawlRes?.html) {
        crawlResult = { status: "success", htmlLength: crawlRes.html.length };
        const text = extractText(crawlRes.html);
        technology = await detectTechnology(domain.domain);
        Object.assign(moderationFlags, moderateContent(text));

        isUnsafe =
          moderationFlags.adult ||
          moderationFlags.hateSpeech ||
          moderationFlags.gambling ||
          moderationFlags.drugs;
      }
    } catch (crawlErr) {
      crawlResult = { status: "failed", error: crawlErr.message };
    }

    // 2. CVTPL Provisioning retry if requested or pending

let cvtplResult =
  domain.cvtpl && typeof domain.cvtpl === "object"
    ? { ...domain.cvtpl }
    : {};

let cvtplError = null;
let cvtplSubmission = null;

const activeStatuses = ["queued", "pending", "processing"];

const hasActiveOperation =
  Boolean(cvtplResult.operationId) &&
  activeStatuses.includes(
    String(cvtplResult.status || "").toLowerCase()
  );

if (isUnsafe) {
  // Unsafe domains must not be submitted for provisioning.
  cvtplResult = {
    ...cvtplResult,
    provisioned: false,
    status: "blocked",
    lastError: "Provisioning blocked because domain content failed moderation.",
    lastAttemptAt: new Date().toISOString(),
  };

  cvtplSubmission = {
    status: "blocked",
    submitted: false,
    reason: "moderation_failed",
  };
} else if (!process.env.CVTPL_API_KEY) {
  cvtplError = "CVTPL_API_KEY is not configured on this server";

  cvtplResult = {
    ...cvtplResult,
    provisioned: false,
    status: hasActiveOperation ? cvtplResult.status : "not_configured",
    lastError: cvtplError,
    lastAttemptAt: new Date().toISOString(),
  };

  cvtplSubmission = {
    status: cvtplResult.status,
    submitted: false,
    error: cvtplError,
  };
} else if (hasActiveOperation) {
  // Do not create a duplicate operation while one is still running.
  cvtplSubmission = {
    status: cvtplResult.status,
    submitted: false,
    alreadyProcessing: true,
    operationId: cvtplResult.operationId,
    pollAfterSeconds: cvtplResult.pollAfterSeconds || 10,
  };
} else {
  try {
    if (typeof cvtplService.submitDomainV2 !== "function") {
      throw new Error(
        "cvtplService.submitDomainV2() is not implemented"
      );
    }

    if (typeof encryptToken !== "function") {
      throw new Error("CVTPL operation token encryption is unavailable");
    }

    const attempt = Number(cvtplResult.attempt || 0) + 1;

    // Unique request ID per new attempt. Reuse the same ID only when
    // retrying the same logical request according to provider rules.
    const requestId =
      `host-age-domain-${domain.id}-attempt-${attempt}`;

    const result = await cvtplService.submitDomainV2({
      userId: domain.userId,
      domain: domain.domain,
      type: "addon",
      requestId,
    });

    if (
      !result ||
      !result.operationId ||
      !result.operationToken ||
      !result.statusUrl
    ) {
      throw new Error(
        "CVTPL V2 returned an incomplete operation response"
      );
    }

    // The provider has accepted the operation, but provisioning
    // is not confirmed yet.
    cvtplResult = {
      ...cvtplResult,
      provisioned: false,
      status: "queued",
      attempt,
      requestId,
      operationId: result.operationId,
      statusUrl: result.statusUrl,
      encryptedOperationToken: encryptToken(result.operationToken),
      pollAfterSeconds: Number(result.pollAfterSeconds) > 0
        ? Number(result.pollAfterSeconds)
        : 10,
      submittedAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      lastCheckedAt: null,
      lastError: null,
    };

    cvtplSubmission = {
      status: "queued",
      submitted: true,
      operationId: result.operationId,
      requestId,
      pollAfterSeconds: cvtplResult.pollAfterSeconds,
    };
  } catch (provErr) {
    cvtplError =
      provErr?.message || "Unable to submit CVTPL provisioning request";

    // Preserve any existing operation details so that a transient
    // submission error does not destroy a previously saved operation.
    cvtplResult = {
      ...cvtplResult,
      provisioned: false,
      status: hasActiveOperation ? cvtplResult.status : "submission_failed",
      lastError: cvtplError,
      lastAttemptAt: new Date().toISOString(),
    };

    cvtplSubmission = {
      status: cvtplResult.status,
      submitted: false,
      error: cvtplError,
    };

    console.error("CVTPL V2 RETRY SUBMISSION ERROR:", {
      domainId: domain.id,
      message: cvtplError,
      status: provErr?.status || null,
    });
  }
}

const newStatus = isUnsafe ? "rejected" : domain.status;

await domain.update({
  technology,
  moderation: {
    status: isUnsafe ? "blocked" : "safe",
    flags: moderationFlags,
    flaggedAt: isUnsafe ? new Date() : null,
  },
  crawler: {
    lastCrawledAt: new Date(),
    crawlStatus: crawlResult.status,
    score:
      crawlResult.status === "success" && !isUnsafe ? 100 : 0,
    issues: isUnsafe
      ? Object.keys(moderationFlags).filter(
          (key) => moderationFlags[key]
        )
      : [],
  },
  cvtpl: cvtplResult,
  status: newStatus,
});

await AuditLog.log({
  action: "DOMAIN_PROVISIONING_RETRIED",
  entity: "Domain",
  entityId: domain.id,
  userId: req.user.id,
  payload: {
    domain: domain.domain,
    crawlStatus: crawlResult.status,
    moderationStatus: isUnsafe ? "blocked" : "safe",
    cvtplStatus: cvtplResult.status,
    cvtplOperationId: cvtplResult.operationId || null,
    cvtplError,
  },
});

const responseStatus = cvtplError
  ? 502
  : cvtplSubmission?.status === "queued" ||
      cvtplSubmission?.status === "pending" ||
      cvtplSubmission?.status === "processing"
    ? 202
    : 200;

return res.status(responseStatus).json({
  success: !cvtplError,
  diagnostics: {
    completed: true,
    crawlStatus: crawlResult.status,
    moderationStatus: isUnsafe ? "blocked" : "safe",
  },
  provisioning: {
    status: cvtplResult.status || "unknown",
    provisioned: cvtplResult.provisioned === true,
    submission: cvtplSubmission,
    error: cvtplError,
  },
  message: cvtplError
    ? "Diagnostics completed, but CVTPL provisioning submission failed."
    : isUnsafe
      ? "Diagnostics completed. Provisioning was blocked by moderation."
      : hasActiveOperation
        ? "Diagnostics completed. Existing CVTPL provisioning operation is still processing."
        : cvtplSubmission?.submitted
          ? "Diagnostics completed. CVTPL accepted the request; awaiting provider confirmation."
          : "Diagnostics completed. Check the provisioning status for the latest result.",
  domain,
  crawlResult,
  cvtplWarning: !process.env.CVTPL_API_KEY
    ? "CVTPL_API_KEY is not configured in the environment."
    : null,
    cvtplError,
  cvtplWarning: !process.env.CVTPL_API_KEY
    ? "CVTPL_API_KEY is not configured in the environment."
    : null,
});
} catch (error) {
  console.error("ADMIN RETRY DOMAIN ERROR:", error);

  return res.status(500).json({
    success: false,
    message: error.message || "Failed to retry domain",
  });
}
});

/* ==========================================================================
   5. HOSTING PLAN MANAGEMENT
   ========================================================================== */

/* ==========================================================================
   5. HOSTING PLAN MANAGEMENT
   ========================================================================== */

/**
 * GET /api/admin/plans
 * List all hosting plans
 */
router.get("/plans", async (req, res) => {
  try {
    const plans = await Plan.findAll({ order: [["price", "ASC"]] });
    return res.json({ success: true, count: plans.length, plans });
  } catch (error) {
    console.error("ADMIN GET PLANS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch hosting plans" });
  }
});

/**
 * POST /api/admin/plans
 * Create a new hosting plan
 */
router.post("/plans", async (req, res) => {
  try {
    const {
      id,
      name,
      price,
      billing_cycle,
      max_websites,
      max_emails,
      max_pages,
      features,
      is_active,
      is_featured,
      description,
    } = req.body || {};

    if (!id || !name) {
      return res.status(400).json({ success: false, message: "Plan ID and Name are required" });
    }

    const cleanId = id.trim().toLowerCase();
    const existing = await Plan.findByPk(cleanId);
    if (existing) {
      return res.status(409).json({ success: false, message: "Plan with this ID already exists" });
    }

    const plan = await Plan.create({
      id: cleanId,
      name: name.trim(),
      price: Number(price) || 0,
      billing_cycle: billing_cycle || "month",
      max_websites: Number(max_websites) || 1,
      max_emails: Number(max_emails) || 1,
      max_pages: Number(max_pages) || 1,
      features: Array.isArray(features) ? features : [],
      is_active: is_active !== false,
      is_featured: Boolean(is_featured),
      description: description || null,
    });

    await AuditLog.log({
      action: "PLAN_CREATED",
      entity: "Plan",
      entityId: plan.id,
      userId: req.user.id,
      payload: { plan: plan.toJSON() },
    });

    return res.status(201).json({ success: true, message: "Plan created successfully", plan });
  } catch (error) {
    console.error("ADMIN CREATE PLAN ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create plan" });
  }
});

/**
 * PATCH /api/admin/plans/:id
 * Update an existing hosting plan
 */
router.patch("/plans/:id", async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const {
      name,
      price,
      billing_cycle,
      max_websites,
      max_emails,
      max_pages,
      features,
      is_active,
      is_featured,
      description,
    } = req.body || {};

    // Validate that the FREE plan cannot have a non-zero price
    if (plan.id === "free" && price !== undefined && Number(price) !== 0) {
      return res.status(400).json({
        success: false,
        message: "The FREE plan must remain free (price ₹0)",
      });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (price !== undefined) updates.price = Number(price);
    if (billing_cycle) updates.billing_cycle = billing_cycle;
    if (max_websites !== undefined) updates.max_websites = Number(max_websites);
    if (max_emails !== undefined) updates.max_emails = Number(max_emails);
    if (max_pages !== undefined) updates.max_pages = Number(max_pages);
    if (Array.isArray(features)) updates.features = features;
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (typeof is_featured === "boolean") updates.is_featured = is_featured;
    if (description !== undefined) updates.description = description;

    await plan.update(updates);

    await AuditLog.log({
      action: "PLAN_UPDATED",
      entity: "Plan",
      entityId: plan.id,
      userId: req.user.id,
      payload: { updates },
    });

    return res.json({ success: true, message: "Plan updated successfully", plan });
  } catch (error) {
    console.error("ADMIN UPDATE PLAN ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update plan" });
  }
});

/* ==========================================================================
   6. BUSINESS EMAIL MANAGEMENT
   ========================================================================== */

/**
 * GET /api/admin/emails
 * List all email mailbox requests
 */
router.get("/emails", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const statusFilter = (req.query.status || "").trim().toLowerCase();

    const where = {};

    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { domain: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (statusFilter && ["pending", "creating", "active", "failed"].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const { count, rows: emailPages } = await EmailPage.findAndCountAll({
      where,
      include: [{ model: User, as: "user", attributes: ["id", "fullName", "email"] }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      emailPages,
    });
  } catch (error) {
    console.error("ADMIN GET EMAILS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch email requests" });
  }
});

/**
 * PATCH /api/admin/emails/:id/status
 * Update mailbox status
 */
router.patch("/emails/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ["pending", "creating", "active", "failed"];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(", ")}`,
      });
    }

    const emailPage = await EmailPage.findByPk(req.params.id);
    if (!emailPage) {
      return res.status(404).json({ success: false, message: "Email record not found" });
    }

    await emailPage.update({ status });

    await AuditLog.log({
      action: "EMAIL_STATUS_UPDATED",
      entity: "EmailPage",
      entityId: emailPage.id,
      userId: req.user.id,
      payload: { email: emailPage.email, status },
    });

    return res.json({
      success: true,
      message: `Email mailbox status updated to ${status}`,
      emailPage,
    });
  } catch (error) {
    console.error("ADMIN UPDATE EMAIL STATUS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update email status" });
  }
});

/**
 * POST /api/admin/emails/:id/retry
 * Retry provisioning email
 */
router.post("/emails/:id/retry", async (req, res) => {
  try {
    const emailPage = await EmailPage.findByPk(req.params.id);
    if (!emailPage) {
      return res.status(404).json({ success: false, message: "Email record not found" });
    }

    // In a production provider environment, trigger provider mailbox API here
    await emailPage.update({ status: "creating" });

    await AuditLog.log({
      action: "EMAIL_PROVISIONING_RETRIED",
      entity: "EmailPage",
      entityId: emailPage.id,
      userId: req.user.id,
      payload: { email: emailPage.email },
    });

    return res.json({
      success: true,
      message: "Provisioning retry initiated. Mailbox status is now 'creating'.",
      emailPage,
    });
  } catch (error) {
    console.error("ADMIN RETRY EMAIL ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to retry email provisioning" });
  }
});

/**
 * DELETE /api/admin/emails/:id
 * Delete mailbox record
 */
router.delete("/emails/:id", async (req, res) => {
  try {
    const emailPage = await EmailPage.findByPk(req.params.id);
    if (!emailPage) {
      return res.status(404).json({ success: false, message: "Email record not found" });
    }

    const targetEmail = emailPage.email;
    await emailPage.destroy();

    await AuditLog.log({
      action: "EMAIL_DELETED",
      entity: "EmailPage",
      entityId: req.params.id,
      userId: req.user.id,
      payload: { email: targetEmail },
    });

    return res.json({ success: true, message: `Email mailbox ${targetEmail} deleted successfully` });
  } catch (error) {
    console.error("ADMIN DELETE EMAIL ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to delete email" });
  }
});

/* ==========================================================================
   7. SUPPORT TICKET MANAGEMENT
   ========================================================================== */

/**
 * GET /api/admin/tickets
 * List support tickets with filters, search, pagination
 */
router.get("/tickets", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();
    const priority = (req.query.priority || "").trim();
    const department = (req.query.department || "").trim();

    const where = {};

    if (search) {
      where[Op.or] = [
        { ticketNumber: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (department) where.department = department;

    const { count, rows: tickets } = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User, as: "user", attributes: ["id", "fullName", "email"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      tickets,
    });
  } catch (error) {
    console.error("ADMIN TICKETS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch support tickets" });
  }
});

/**
 * GET /api/admin/tickets/:id
 * Full ticket details with conversation, notes, history
 */
router.get("/tickets/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "fullName", "email", "phone"] },
        {
          model: TicketMessage,
          include: [{ model: TicketAttachment }, { model: User, attributes: ["id", "fullName", "role"] }],
          order: [["createdAt", "ASC"]],
        },
        {
          model: TicketInternalNote,
          order: [["createdAt", "DESC"]],
        },
        {
          model: TicketHistory,
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    return res.json({ success: true, ticket });
  } catch (error) {
    console.error("ADMIN GET TICKET ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch ticket details" });
  }
});

/**
 * PATCH /api/admin/tickets/:id
 * Update status, priority, or department
 */
router.patch("/tickets/:id", async (req, res) => {
  try {
    const { status, priority, department } = req.body || {};
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const oldStatus = ticket.status;
    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (department) updates.department = department;

    await ticket.update(updates);

    if (status && status !== oldStatus) {
      await TicketHistory.create({
        ticketId: ticket.id,
        action: "Status Changed",
        oldValue: oldStatus,
        newValue: status,
        performedBy: req.user.id,
      });
    }

    await AuditLog.log({
      action: "TICKET_UPDATED",
      entity: "Ticket",
      entityId: ticket.id,
      userId: req.user.id,
      payload: { updates, ticketNumber: ticket.ticketNumber },
    });

    return res.json({ success: true, message: "Ticket updated successfully", ticket });
  } catch (error) {
    console.error("ADMIN UPDATE TICKET ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update ticket" });
  }
});

/**
 * POST /api/admin/tickets/:id/reply
 * Staff admin reply to ticket
 */
router.post("/tickets/:id/reply", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Reply message cannot be empty" });
    }

    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const ticketMessage = await TicketMessage.create({
      ticketId: ticket.id,
      senderId: req.user.id,
      senderType: "Admin",
      message: message.trim(),
    });

    await TicketHistory.create({
      ticketId: ticket.id,
      action: "Admin Reply",
      oldValue: null,
      newValue: "Admin replied to ticket",
      performedBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Reply sent successfully",
      data: ticketMessage,
    });
  } catch (error) {
    console.error("ADMIN TICKET REPLY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to post reply" });
  }
});

/**
 * POST /api/admin/tickets/:id/internal-note
 * Add internal staff note to ticket
 */
router.post("/tickets/:id/internal-note", async (req, res) => {
  try {
    const { note } = req.body || {};
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: "Note cannot be empty" });
    }

    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const internalNote = await TicketInternalNote.create({
      ticketId: ticket.id,
      adminId: req.user.id,
      note: note.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Internal note added successfully",
      note: internalNote,
    });
  } catch (error) {
    console.error("ADMIN INTERNAL NOTE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to add internal note" });
  }
});

/**
 * PUT /api/admin/tickets/:id/assign
 * Assign ticket to agent
 */
router.put("/tickets/:id/assign", async (req, res) => {
  try {
    const { agentId } = req.body || {};
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    await ticket.update({ assignedAgentId: agentId || null });

    await TicketHistory.create({
      ticketId: ticket.id,
      action: "Agent Assigned",
      oldValue: null,
      newValue: agentId || "Unassigned",
      performedBy: req.user.id,
    });

    return res.json({
      success: true,
      message: "Agent assigned successfully",
      ticket,
    });
  } catch (error) {
    console.error("ADMIN ASSIGN AGENT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to assign agent" });
  }
});

/* ==========================================================================
   8. SUBSCRIPTIONS AND PAYMENTS
   ========================================================================== */

/**
 * GET /api/admin/payments
 * Live payment records
 */
router.get("/payments", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim().toUpperCase();

    const where = {};
    if (search) {
      where[Op.or] = [
        { customerName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { razorpayPaymentId: { [Op.iLike]: `%${search}%` } },
        { razorpayOrderId: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (status && ["PENDING", "SUCCESS", "FAILED", "REFUNDED"].includes(status)) {
      where.status = status;
    }

    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      payments,
    });
  } catch (error) {
    console.error("ADMIN PAYMENTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch payment records" });
  }
});

/**
 * GET /api/admin/subscriptions
 * Live subscription records
 */
router.get("/subscriptions", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    const { count, rows: subscriptions } = await Subscription.findAndCountAll({
      include: [{ model: User, as: "user", attributes: ["id", "fullName", "email"] }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      subscriptions,
    });
  } catch (error) {
    console.error("ADMIN SUBSCRIPTIONS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch subscriptions" });
  }
});

/* ==========================================================================
   9. CVTPL & HOSTING INTEGRATION
   ========================================================================== */

/**
 * GET /api/admin/cvtpl/status
 * Provider connection check and configuration diagnostics
 */
router.get("/cvtpl/status", async (req, res) => {
  try {
    const isConfigured = Boolean(process.env.CVTPL_API_KEY && process.env.CVTPL_API_KEY.trim());
    const apiUrl = process.env.CVTPL_API_URL || "https://admin.cvtpl.com/api/v1/partner";

    let connectivity = "not_configured";
    let providerResponse = null;
    let providerError = null;

    if (isConfigured) {
      try {
        // Attempt a read or test call
        const check = await cvtplService.getCvtplDomains("health-check");
        connectivity = "operational";
        providerResponse = check?.data || check;
      } catch (err) {
        connectivity = "error";
        providerError = err.message;
      }
    }

    return res.json({
      success: true,
      config: {
        configured: isConfigured,
        apiUrl,
        hasKey: isConfigured,
      },
      connectivity,
      providerError,
      providerResponse,
    });
  } catch (error) {
    console.error("ADMIN CVTPL STATUS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to check CVTPL status" });
  }
});

/**
 * POST /api/admin/cvtpl/provision/:domainId
 * Directly trigger CVTPL domain provisioning
 */
router.post("/cvtpl/provision/:domainId", async (req, res) => {
  try {
    if (!process.env.CVTPL_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "CVTPL integration is not configured",
      });
    }

    const domain = await Domain.findByPk(req.params.domainId);

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: "Domain not found",
      });
    }

    const existing = domain.cvtpl || {};

    // Never create a second operation while the first is pending.
    if (
      existing.operationId &&
      ["queued", "pending", "processing"].includes(existing.status)
    ) {
      return res.status(202).json({
        success: true,
        status: existing.status,
        message: "Domain provisioning is already processing",
      });
    }

    // Stable identifier: do not generate a new ID on every retry.
    const requestId = `host-age-domain-${domain.id}`;

    const result = await cvtplService.submitDomainV2({
      userId: domain.userId,
      domain: domain.domain,
      type: "addon",
      requestId,
    });

    const cvtplData = {
      ...existing,
      provisioned: false,
      status: "queued",
      requestId,
      operationId: result.operationId,
      statusUrl: result.statusUrl,
      encryptedOperationToken: encryptToken(result.operationToken),
      pollAfterSeconds: result.pollAfterSeconds,
      lastError: null,
      submittedAt: new Date().toISOString(),
    };

    // This assumes Domain.cvtpl is a persisted JSON/JSONB field.
    await domain.update({ cvtpl: cvtplData });

    // Do NOT set status="verified" or verified=true here.
    return res.status(202).json({
      success: true,
      status: "queued",
      message: "Domain provisioning request accepted; awaiting provider confirmation",
      domainId: domain.id,
      operationId: result.operationId,
      pollAfterSeconds: result.pollAfterSeconds,
    });
  } catch (error) {
    console.error("CVTPL V2 SUBMIT ERROR:", {
      status: error.status,
      message: error.message,
    });

    return res.status(error.status || 502).json({
      success: false,
      message: error.message || "Unable to submit domain provisioning request",
    });
  }
});


/**
 * GET /api/admin/cvtpl/operation/:domainId
 * Fetch the real operation status from CVTPL V2.
 *
 * IMPORTANT:
 * Unknown provider statuses never count as success.
 */
router.get("/cvtpl/operation/:domainId", async (req, res) => {
  try {
    const domain = await Domain.findByPk(req.params.domainId);

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: "Domain not found",
      });
    }

    const current = domain.cvtpl || {};

    if (!current.operationId || !current.statusUrl) {
      return res.status(409).json({
        success: false,
        message: "No CVTPL operation is recorded for this domain",
      });
    }

    if (!current.encryptedOperationToken) {
      return res.status(409).json({
        success: false,
        message: "Operation token is unavailable; status cannot be checked",
      });
    }

    const { decryptToken } = require("../utils/cvtplTokenCrypto");

    const operationToken = decryptToken(
      current.encryptedOperationToken
    );

    const result = await cvtplService.getDomainOperationV2({
      statusUrl: current.statusUrl,
      operationToken,
    });

    /*
     * Do not guess the provider's terminal status names.
     * Until its documented response contract is mapped,
     * store the response as pending and do not mark provisioned.
     */
    const updated = {
      ...current,
      provisioned: false,
      status: "processing",
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
      providerStatusSnapshot: result,
    };

    await domain.update({ cvtpl: updated });

    return res.status(200).json({
      success: true,
      status: updated.status,
      provisioned: false,
      message:
        "Provider status fetched. Final status mapping is required before confirming provisioning.",
      domainId: domain.id,
      operationId: current.operationId,
      lastCheckedAt: updated.lastCheckedAt,
    });
  } catch (error) {
    console.error("CVTPL OPERATION STATUS ERROR:", {
      status: error.status,
      message: error.message,
    });

    return res.status(error.status || 502).json({
      success: false,
      message: "Unable to fetch CVTPL operation status",
    });
  }
});


/* ==========================================================================
   10. AUDIT LOGS
   ========================================================================== */

/**
 * GET /api/admin/audit-logs
 * Chronological log of admin actions
 */
router.get("/audit-logs", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const action = (req.query.action || "").trim();
    const entity = (req.query.entity || "").trim();

    const where = {};
    if (action) where.action = { [Op.iLike]: `%${action}%` };
    if (entity) where.entity = entity;

    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      logs,
    });
  } catch (error) {
    console.error("ADMIN AUDIT LOGS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch audit logs" });
  }
});


module.exports = router;
