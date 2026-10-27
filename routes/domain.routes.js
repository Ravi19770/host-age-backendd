const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middleware/Auth.js");

const upload = multer({
  storage: multer.memoryStorage(),
});

const { uploadDomain } = require("../controllers/domain.controller");
const { verifyDns } = require("../controllers/dns.controller");

router.post(
  "/upload",
  authMiddleware,
  upload.single("websiteFile"),
  uploadDomain
);

router.post("/:id/verify-dns", authMiddleware, verifyDns);

module.exports = router;