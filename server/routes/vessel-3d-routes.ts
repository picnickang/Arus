/**
 * Push A3 — 3D Digital Twin Viewer routes.
 *
 * - POST  /api/v1/vessels/:vesselId/3d-model    — upload .glb (admin)
 * - GET   /api/v1/vessels/:vesselId/3d-model    — metadata (latest)
 * - GET   /api/v1/vessels/3d-model/:modelId/binary — auth-checked file stream
 * - PATCH /api/v1/vessels/3d-model/:modelId/pins   — replace equipment pins
 * - GET   /api/v1/vessels/equipment/:equipmentId/dependencies — failure
 *         propagation (knowledge graph) for the 3D dependency overlay
 *
 * Files live under `.data/vessel-3d/<orgId>/`, never publicly addressable.
 */

import { Router, type Request, type Response } from "express";
import { generalApiRateLimit } from "../middleware/rate-limiters";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { equipmentPinSchema, type EquipmentPin, type Vessel3dModel } from "@shared/schema-runtime";
import {
  findVesselInOrg,
  insertVessel3dModel,
  getLatestVessel3dModel,
  getVessel3dModelById,
  updateVessel3dModelPins,
  listVessel3dModels,
  promoteVessel3dModel,
  deleteVessel3dModel,
} from "../db/vessel-3d/queries";
import { z } from "zod";
import { createLogger } from "../lib/structured-logger";
import { failurePropagation } from "../db/graph-adapter";
import { requireRole } from "../middleware/role-auth";
import { enforceQuota } from "../middleware/tenant-quota";
import { quotaService } from "../tenancy/quota-service";
import { authenticatedRequest } from "../middleware/auth";

const logger = createLogger("Routes:Vessel3D");

/**
 * P2 #33 — Validate the `equipment_pins` JSONB column at the route
 * boundary. Writes already go through `pinsSchema`, but historical
 * rows (and any direct SQL fix) are typed `unknown` by drizzle's
 * jsonb. We narrow on read so the JSON returned to the 3D viewer
 * carries the documented `{equipmentId,x,y,z,label?}[]` contract.
 * A malformed row degrades to `[]` with a warning instead of
 * throwing — the model render still works without phantom pins.
 */
const equipmentPinsReadSchema = z.array(equipmentPinSchema);
function narrowEquipmentPins(value: unknown): EquipmentPin[] {
  if (value === null || value === undefined) {
    return [];
  }
  const parsed = equipmentPinsReadSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn("Discarding malformed vessel_3d_models.equipment_pins JSONB", {
      issues: parsed.error.issues.slice(0, 3),
    });
    return [];
  }
  return parsed.data;
}
function narrowVessel3dModel<T extends Vessel3dModel>(row: T): T {
  return { ...row, equipmentPins: narrowEquipmentPins(row.equipmentPins) };
}

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
// Self-contained binary glTF only. We deliberately reject `.gltf` because that
// format usually references external `.bin`/texture files via relative URIs,
// and the binary-serving route only resolves the single stored model file —
// loaders would fault on the sidecars. `.glb` bundles all buffers + textures
// in one file, so it always renders correctly through the auth-checked route.
const ALLOWED_EXT = new Set([".glb"]);
const ALLOWED_MIME = new Set([
  "model/gltf-binary",
  "application/octet-stream", // common for .glb
]);

const STORAGE_BASE = (() => {
  const preferred = path.join(process.cwd(), ".data", "vessel-3d");
  try {
    fs.mkdirSync(preferred, { recursive: true, mode: 0o700 });
    return preferred;
  } catch {
    const fallback = "/tmp/vessel-3d";
    // Match the primary path's 0o700 perms so fallback can't widen access
    // when multiple users share /tmp.
    fs.mkdirSync(fallback, { recursive: true, mode: 0o700 });
    try {
      fs.chmodSync(fallback, 0o700);
    } catch {
      /* noop */
    }
    logger.warn("Falling back to /tmp/vessel-3d for model storage");
    return fallback;
  }
})();

function orgDir(orgId: string): string {
  const safe = orgId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe || safe === "." || safe === "..") {
    throw new Error("Invalid orgId for model storage");
  }
  const dir = path.join(STORAGE_BASE, safe);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

/**
 * P2 #23 — Pre-write validation. The previous diskStorage variant
 * wrote the uploaded file to disk first and only ran the magic-byte
 * + vessel-ownership + pin-Zod checks afterward, then unlinked on
 * failure. That left two real failure modes:
 *
 *   (a) Disk fills from invalid uploads when unlink racing fails
 *       (ENOSPC, mid-write OS crash), leaking up to MAX_BYTES per
 *       attempt before the validator gets a chance to reject.
 *   (b) An attacker who can hit the endpoint can keep writing and
 *       being-rejected, never persisting a row but always burning
 *       inode + bytes on the host's storage volume.
 *
 * Switching to memoryStorage keeps the multer fileSize guard (so
 * RAM is bounded by MAX_BYTES) and lets us run every validation
 * step before any disk I/O. The disk write becomes the LAST step
 * — and only happens if everything else passed.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error("Only self-contained .glb files are allowed"));
    }
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
      // mimetype is advisory — accept if extension matches.
      logger.info("Accepting unusual mimetype based on extension", {
        mimetype: file.mimetype,
        ext,
      });
    }
    cb(null, true);
  },
});

const pinsSchema = z.object({ pins: z.array(equipmentPinSchema).max(2000) });

const router = Router();

// Rate-limit every handler on this router (CWE-770). No-op in tests/dev relax.
router.use(generalApiRateLimit);

// ---------- Upload (admin only) ----------
// Wrap multer so its errors (size, type, etc.) map to explicit 400/413
// responses instead of falling through to the global 500 handler.
function uploadSingleModel(req: Request, res: Response, next: (err?: unknown) => void) {
  upload.single("model")(req, res, (err: unknown) => {
    if (!err) {
      return next();
    }
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    const message =
      err &&
      typeof err === "object" &&
      "message" in err &&
      typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : null;
    if (message) {
      return res.status(400).json({ error: message });
    }
    return next(err);
  });
}

router.post(
  "/vessels/:vesselId/3d-model",
  requireRole("admin", "chief_engineer"),
  enforceQuota("storage_bytes"),
  uploadSingleModel,
  async (req: Request, res: Response) => {
    let writtenPath: string | null = null;
    try {
      const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
      const { vesselId = "" } = req.params;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({ error: "Uploaded file is empty" });
      }

      // P2 #23 — All validation runs against the in-memory buffer.
      // Nothing touches disk until every check passes.

      // 1) Magic-byte check on the in-memory buffer. GLB files start
      //    with ASCII "glTF" (0x67 0x6C 0x54 0x46).
      if (file.buffer.length < 4 || file.buffer.subarray(0, 4).toString("ascii") !== "glTF") {
        return res.status(400).json({
          error: "File is not a valid GLB (missing glTF magic header)",
        });
      }

      // 2) Verify vessel belongs to org.
      const vessel = await findVesselInOrg(vesselId, orgId);
      if (!vessel) {
        return res.status(404).json({ error: "Vessel not found" });
      }

      // 3) Parse optional equipment pins.
      let pins: EquipmentPin[] = [];
      if (typeof req.body?.equipmentPins === "string" && req.body.equipmentPins.length > 0) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(req.body.equipmentPins);
        } catch {
          return res.status(400).json({ error: "equipmentPins is not valid JSON" });
        }
        const v = z.array(equipmentPinSchema).max(2000).safeParse(parsed);
        if (!v.success) {
          return res.status(400).json({ error: v.error.flatten().fieldErrors });
        }
        pins = v.data;
      }

      // 4) ONLY NOW commit the bytes to disk. If the disk write fails
      //    we have nothing to unlink — buffer is GC'd.
      const ext = path.extname(file.originalname).toLowerCase();
      const targetDir = orgDir(orgId);
      const targetPath = path.join(targetDir, `${Date.now()}-${randomUUID()}${ext}`);
      try {
        await fs.promises.writeFile(targetPath, file.buffer, { mode: 0o600 });
        writtenPath = targetPath;
      } catch (writeErr) {
        logger.error("Failed to persist validated 3D model to disk", {
          error: writeErr instanceof Error ? writeErr.message : String(writeErr),
          vesselId,
        });
        return res.status(500).json({ error: "Failed to persist uploaded file" });
      }

      // 5) Insert metadata row. On failure, unlink the file we just wrote.
      let row;
      try {
        row = await insertVessel3dModel({
          orgId,
          vesselId,
          filename: file.originalname,
          // Canonicalise to the GLB spec mime; the uploaded mimetype is
          // advisory and varies by client. We've already verified the magic
          // header so it's safe to assert this on serve.
          mimetype: "model/gltf-binary",
          sizeBytes: file.size,
          storedPath: writtenPath,
          equipmentPins: pins,
        });
      } catch (dbErr) {
        try {
          fs.unlinkSync(writtenPath);
          writtenPath = null;
        } catch {
          /* noop */
        }
        logger.error("Vessel 3D model DB insert failed; uploaded file removed", {
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          vesselId,
        });
        return res.status(500).json({ error: "Failed to persist model metadata" });
      }

      // Task #89: 3D models are stored on disk and contribute to the
      // tenant's storage_bytes quota. Increment AFTER the metadata row
      // commits so failed inserts don't pollute the counter.
      void quotaService.incrementUsage(orgId, "storage_bytes", file.size);

      return res.status(201).json(row);
    } catch (error) {
      // Last-resort cleanup: only relevant if disk write succeeded but
      // an unexpected error fired before the metadata row was created.
      if (writtenPath) {
        try {
          fs.unlinkSync(writtenPath);
        } catch {
          /* noop */
        }
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Upload failed", { error: message });
      return res.status(500).json({ error: message });
    }
  }
);

// ---------- Latest model metadata for a vessel ----------
router.get("/vessels/:vesselId/3d-model", async (req: Request, res: Response) => {
  try {
    const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
    const { vesselId = "" } = req.params;
    const row = await getLatestVessel3dModel(orgId, vesselId);
    if (!row) {
      return res.status(404).json({ error: "No 3D model attached" });
    }
    // Do not leak storedPath.
    const { storedPath: _omit, ...safe } = narrowVessel3dModel(row);
    return res.json(safe);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

// ---------- Stream binary (auth-checked) ----------
router.get("/vessels/3d-model/:modelId/binary", async (req: Request, res: Response) => {
  try {
    const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
    const { modelId = "" } = req.params;
    const row = await getVessel3dModelById(orgId, modelId);
    if (!row) {
      return res.status(404).json({ error: "Model not found" });
    }

    // Path-traversal guard: stored file must live under the org's directory.
    const expectedDir = orgDir(orgId);
    const resolved = path.resolve(row.storedPath);
    if (!resolved.startsWith(path.resolve(expectedDir) + path.sep)) {
      logger.warn("Refusing to serve out-of-bounds file", { modelId, orgId });
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(410).json({ error: "Stored file missing" });
    }
    // Always serve as the canonical GLB mime — extension/file metadata is
    // not trusted on the wire.
    res.setHeader("Content-Type", "model/gltf-binary");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", String(row.sizeBytes));
    res.setHeader("Cache-Control", "private, max-age=300");
    fs.createReadStream(resolved).pipe(res);
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

// ---------- Replace equipment pins (admin only) ----------
router.patch(
  "/vessels/3d-model/:modelId/pins",
  requireRole("admin", "chief_engineer"),
  async (req: Request, res: Response) => {
    try {
      const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
      const { modelId = "" } = req.params;
      const parsed = pinsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }
      const row = await updateVessel3dModelPins(orgId, modelId, parsed.data.pins);
      if (!row) {
        return res.status(404).json({ error: "Model not found" });
      }
      const { storedPath: _omit, ...safe } = narrowVessel3dModel(row);
      return res.json(safe);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ error: message });
    }
  }
);

// ---------- Version history (Task #99) ----------
// List every uploaded GLB for a vessel ordered newest-first so admins
// can roll back a bad upload. storedPath is stripped before returning.
router.get("/vessels/:vesselId/3d-model/history", async (req: Request, res: Response) => {
  try {
    const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
    const { vesselId = "" } = req.params;
    const rows = await listVessel3dModels(orgId, vesselId);
    const safe = rows.map((r) => {
      const { storedPath: _omit, ...rest } = narrowVessel3dModel(r);
      return rest;
    });
    return res.json(safe);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

// Promote an older row to "current" by stamping its createdAt to now.
// The latest-metadata GET already orders by createdAt desc, so a fresh
// stamp is the canonical signal across the rest of the system without
// requiring a separate `is_current` column.
router.post(
  "/vessels/3d-model/:modelId/promote",
  requireRole("admin", "chief_engineer"),
  async (req: Request, res: Response) => {
    try {
      const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
      const { modelId = "" } = req.params;
      const now = new Date();
      const row = await promoteVessel3dModel(orgId, modelId, now);
      if (!row) {
        return res.status(404).json({ error: "Model not found" });
      }
      const { storedPath: _omit, ...safe } = narrowVessel3dModel(row);
      return res.json(safe);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ error: message });
    }
  }
);

// Delete a single model row + its on-disk file and credit the freed
// bytes back to the tenant's storage_bytes quota. The deletion is
// row-scoped: deleting "current" simply makes the next-newest row
// the current one via the latest-metadata GET's ORDER BY.
router.delete(
  "/vessels/3d-model/:modelId",
  requireRole("admin", "chief_engineer"),
  async (req: Request, res: Response) => {
    try {
      const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
      const { modelId = "" } = req.params;
      const row = await getVessel3dModelById(orgId, modelId);
      if (!row) {
        return res.status(404).json({ error: "Model not found" });
      }

      // Path-traversal guard (same as binary serve): only unlink files
      // that resolve inside the org's storage directory.
      const expectedDir = orgDir(orgId);
      const resolved = path.resolve(row.storedPath);
      if (resolved.startsWith(path.resolve(expectedDir) + path.sep)) {
        try {
          fs.unlinkSync(resolved);
        } catch (err) {
          // Missing file is fine — we still want to clear the DB row so
          // the history stops showing a phantom version.
          if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
            logger.warn("Failed to unlink stored 3D model", {
              modelId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } else {
        logger.warn("Refusing to unlink out-of-bounds file", { modelId, orgId });
      }

      await deleteVessel3dModel(orgId, modelId);

      const freed = Number(row.sizeBytes ?? 0);
      if (Number.isFinite(freed) && freed > 0) {
        void quotaService.incrementUsage(orgId, "storage_bytes", -freed);
      }

      return res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ error: message });
    }
  }
);

// ---------- Dependency graph for 3D overlay ----------
// Thin proxy over `failurePropagation` so the 3D viewer can highlight
// downstream equipment when an operator clicks a pin. Empty array when
// GRAPH_ENABLED=false (no-op adapter) — caller treats absence as "no overlay".
router.get("/vessels/equipment/:equipmentId/dependencies", async (req: Request, res: Response) => {
  try {
    const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
    const { equipmentId = "" } = req.params;
    const hopsParsed = z.coerce
      .number()
      .int()
      .min(1)
      .max(5)
      .default(3)
      .safeParse(req.query["maxHops"] ?? 3);
    if (!hopsParsed.success) {
      return res.status(400).json({ error: "maxHops must be an integer between 1 and 5" });
    }
    const maxHops = hopsParsed.data;
    const downstream = await failurePropagation(orgId, equipmentId, maxHops);
    return res.json({ equipmentId, downstream });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

export { router as vessel3dRouter };
