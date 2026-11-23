const ownerMiddleware = (req, res, next) => {
  const ownerId = process.env.OWNER_ADMIN_ID;

  if (!ownerId) {
    console.error("OWNER_ADMIN_ID is missing");

    return res.status(500).json({
      success: false,
      message: "Server configuration error",
    });
  }

  if (String(req.user?.id) !== String(ownerId)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Owner only.",
    });
  }

  next();
};

module.exports = ownerMiddleware;