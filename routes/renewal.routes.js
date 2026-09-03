const express = require("express");

const router = express.Router();

const renewalController = require("../controllers/renewal.controller");

const authMiddleware = require("../middleware/Auth.js");

router.get(
  "/:id/renewal",
  authMiddleware,
  renewalController.getRenewal
);

router.put(
  "/:id/renewal",
  authMiddleware,
  renewalController.updateRenewal
);

module.exports = router;