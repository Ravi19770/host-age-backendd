const fs = require("fs");
const path = require("path");
const yauzl = require("yauzl");
const { pipeline } = require("stream/promises");

const MAX_FILES = Number(process.env.MAX_WEBSITE_FILES || 20000);
const MAX_EXTRACTED_BYTES = Number(
  process.env.MAX_WEBSITE_EXTRACTED_BYTES || 2 * 1024 * 1024 * 1024
);

function openZip(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      {
        lazyEntries: true,
        decodeStrings: true,
        validateEntrySizes: true,
      },
      (error, zipFile) => {
        if (error) return reject(error);
        resolve(zipFile);
      }
    );
  });
}

function readEntry(zipFile, entry) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      resolve(stream);
    });
  });
}

function safeEntryPath(entryName) {
  if (
    typeof entryName !== "string" ||
    !entryName ||
    entryName.includes("\0") ||
    entryName.includes("\\")
  ) {
    throw new Error("ZIP contains an invalid file path");
  }

  const normalized = path.posix.normalize(entryName);

  if (
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new Error("ZIP contains an unsafe file path");
  }

  return normalized;
}

function isSymlink(entry) {
  const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
  return mode === 0xa000;
}

async function extractWebsiteZip(zipPath, destination) {
  await fs.promises.mkdir(destination, {
    recursive: true,
    mode: 0o750,
  });

  const zipFile = await openZip(zipPath);

  let fileCount = 0;
  let extractedBytes = 0;
  let settled = false;

  return new Promise((resolve, reject) => {
    const fail = (error) => {
      if (settled) return;
      settled = true;
      try {
        zipFile.close();
      } catch (_) {}
      reject(error);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        zipFile.close();
      } catch (_) {}
      resolve({
        fileCount,
        extractedBytes,
      });
    };

    zipFile.on("error", fail);

    zipFile.on("entry", async (entry) => {
      try {
        if (isSymlink(entry)) {
          throw new Error("ZIP symlinks are not allowed");
        }

        const relativePath = safeEntryPath(entry.fileName);
        if (relativePath === ".") {
          zipFile.readEntry();
          return;
        }

        const isDirectory = entry.fileName.endsWith("/");
        const outputPath = path.resolve(destination, relativePath);
        const rootPath = path.resolve(destination) + path.sep;

        if (
          outputPath !== path.resolve(destination) &&
          !outputPath.startsWith(rootPath)
        ) {
          throw new Error("ZIP path traversal detected");
        }

        if (isDirectory) {
          await fs.promises.mkdir(outputPath, {
            recursive: true,
            mode: 0o750,
          });
          zipFile.readEntry();
          return;
        }

        fileCount += 1;
        extractedBytes += Number(entry.uncompressedSize || 0);

        if (fileCount > MAX_FILES) {
          throw new Error("ZIP contains too many files");
        }

        if (extractedBytes > MAX_EXTRACTED_BYTES) {
          throw new Error("Extracted ZIP size exceeds the allowed limit");
        }

        if (Number(entry.uncompressedSize) > MAX_EXTRACTED_BYTES) {
          throw new Error("ZIP entry exceeds the allowed size");
        }

        await fs.promises.mkdir(path.dirname(outputPath), {
          recursive: true,
          mode: 0o750,
        });

        const input = await readEntry(zipFile, entry);
        const output = fs.createWriteStream(outputPath, {
          flags: "wx",
          mode: 0o640,
        });

        await pipeline(input, output);
        zipFile.readEntry();
      } catch (error) {
        fail(error);
      }
    });

    zipFile.on("end", finish);
    zipFile.readEntry();
  });
}

async function validateWebsiteRoot(extractedPath) {
  const indexPath = path.join(extractedPath, "index.html");

  let stat;
  try {
    stat = await fs.promises.stat(indexPath);
  } catch (_) {
    throw new Error(
      "ZIP must contain index.html in its root directory"
    );
  }

  if (!stat.isFile() || stat.size === 0) {
    throw new Error("Website index.html is invalid or empty");
  }

  return indexPath;
}

module.exports = {
  extractWebsiteZip,
  validateWebsiteRoot,
};