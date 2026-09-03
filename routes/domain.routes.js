const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middleware/Auth.js");

const upload = multer({
  storage: multer.memoryStorage(),
});

const { uploadDomain } = require("../controllers/domain.controller");

router.post(
  "/upload",
  authMiddleware,
  upload.single("websiteFile"),
  uploadDomain
);



module.exports = router;