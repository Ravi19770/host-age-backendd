/**
 * Host-Age RBAC role middleware.
 *
 * Usage:
 *   router.get("/admin-only", authMiddleware, role("ADMIN"), handler);
 */
const role = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles
    .map((value) => String(value).trim().toUpperCase())
    .filter(Boolean);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userRole = String(req.user.role || "").trim().toUpperCase();

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: insufficient permissions",
      });
    }

    return next();
  };
};

module.exports = role;
