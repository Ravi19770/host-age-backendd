const express = require("express");
const { Op } = require("sequelize");
const User = require("../models/User");

const router = express.Router();

/**
 * GET /api/admin/me
 * Verify the authenticated account is an ADMIN.
 */
router.get("/me", async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: {
      exclude: ["password", "resetToken", "resetTokenExpire"],
    },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Admin user not found",
    });
  }

  return res.json({
    success: true,
    user,
  });
});

/**
 * GET /api/admin/users
 * Admin-only user list.
 */
router.get("/users", async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: {
        exclude: ["password", "resetToken", "resetTokenExpire"],
      },
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch users",
    });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Admin-only account activation/deactivation.
 */
router.patch("/users/:id/status", async (req, res) => {
  try {
    const { isActive } = req.body || {};

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    if (req.params.id === req.user.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own admin account",
      });
    }

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.update({ isActive });

    const safeUser = user.toJSON();

    return res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: safeUser,
    });
  } catch (error) {
    console.error("ADMIN USER STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update user status",
    });
  }
});

/**
 * GET /api/admin/stats
 * Basic RBAC/admin dashboard statistics.
 */
router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, totalAdmins, activeUsers, inactiveUsers] =
      await Promise.all([
        User.count(),
        User.count({ where: { role: "ADMIN" } }),
        User.count({ where: { isActive: true } }),
        User.count({ where: { isActive: false } }),
      ]);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalAdmins,
        activeUsers,
        inactiveUsers,
      },
    });
  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch admin statistics",
    });
  }
});

module.exports = router;
