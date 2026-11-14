const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const authMiddleware = require("../middleware/Auth.js");

const {
  uploadDomain,
} = require("../controllers/domain.controller");

const {
  verifyDns,
} = require("../controllers/dns.controller");

const UPLOAD_DIR = path.join(
  process.cwd(),
  "tmp",
  "website-uploads"
);

const MAX_FILE_SIZE =
  Number(process.env.MAX_WEBSITE_UPLOAD_BYTES) ||
  1024 * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true,
  mode: 0o750,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}.zip`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 30,
    fieldSize: 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const extension = path.extname(
      file.originalname || ""
    ).toLowerCase();

    if (extension !== ".zip") {
      return cb(
        new Error("Only ZIP website files are allowed")
      );
    }

    cb(null, true);
  },
});

function handleWebsiteUpload(req, res, next) {
  upload.single("websiteFile")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "Website ZIP must not exceed 1GB",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Website upload failed",
    });
  });
}

router.post(
  "/upload",
  authMiddleware,
  handleWebsiteUpload,
  uploadDomain
);

router.post(
  "/:id/verify-dns",
  authMiddleware,
  verifyDns
);

module.exports = router;