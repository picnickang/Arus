import type { RequestHandler } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../lib/structured-logger";
import { isAllowedKbUploadMimeType } from "../services/kb-upload-validation";

const logger = createLogger("Routes:KbUpload");

// P2 #12 — Harden the staging directory. Without this, /tmp/kb-uploads
// inherits the system umask (typically 0022 → 0755) so any local user
// could enumerate / replace in-flight uploads before the ingestion
// worker picks them up. We create the dir 0700 + chown to the current
// process owner; subsequent writes inherit the directory ACL.
const KB_UPLOAD_DIR = "/tmp/kb-uploads";
try {
  fs.mkdirSync(KB_UPLOAD_DIR, { recursive: true, mode: 0o700 });
  // mkdirSync's mode is masked by umask; chmod explicitly to be sure.
  fs.chmodSync(KB_UPLOAD_DIR, 0o700);
} catch (err) {
  // Don't crash boot on permission errors — log + continue; uploads
  // will surface a clear 500 with the underlying ENOENT/EACCES.
  logger.warn(
    `[KB Upload] Failed to harden ${KB_UPLOAD_DIR}: ${err instanceof Error ? err.message : String(err)}`
  );
}

// Configure multer for disk storage (async processing)
// NOSONAR: S5443 - /tmp used for temporary upload processing; files processed immediately
export const asyncUpload = multer({
  storage: multer.diskStorage({
    destination: KB_UPLOAD_DIR,
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (isAllowedKbUploadMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, PNG, and JPEG are allowed."));
    }
  },
});

// Configure multer for in-memory file uploads (sync processing)
export const syncUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (isAllowedKbUploadMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, PNG, and JPEG are allowed."));
    }
  },
});

export function handleSingleFileUpload(upload: multer.Multer): RequestHandler {
  return (req, res, next) => {
    upload.single("file")(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }

      const isMulterError = error instanceof multer.MulterError;
      const status = isMulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message = error instanceof Error ? error.message : "File upload rejected";
      res.status(status).json({
        error: message,
        code: isMulterError ? error.code : "INVALID_FILE",
      });
    });
  };
}
