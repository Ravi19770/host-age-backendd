
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const key = process.env.CVTPL_OPERATION_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      "CVTPL_OPERATION_ENCRYPTION_KEY must be a 64-character hex key"
    );
  }

  return Buffer.from(key, "hex");
}

function encryptToken(token) {
  if (typeof token !== "string" || !token) {
    throw new Error("Operation token is required");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

function decryptToken(payload) {
  if (typeof payload !== "string") {
    throw new Error("Encrypted token is required");
  }

  const [ivHex, tagHex, encryptedHex, ...extra] = payload.split(":");

  if (
    extra.length ||
    !/^[a-fA-F0-9]{24}$/.test(ivHex || "") ||
    !/^[a-fA-F0-9]{32}$/.test(tagHex || "") ||
    !/^(?:[a-fA-F0-9]{2})+$/.test(encryptedHex || "")
  ) {
    throw new Error("Invalid encrypted token format");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { encryptToken, decryptToken };


