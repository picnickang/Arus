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
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { vessel3dModels, equipmentPinSchema, vessels, type EquipmentPin } from "@shared/schema";
import { z } from "zod";
import { createLogger } from "../lib/structured-logger";
import { failurePropagation } from "../graph/adapter";
import { requireRole } from "../middleware/role-auth";
import { enforceQuota } from "../middleware/tenant-quota";
import { quotaService } from "../tenancy/quota-service";

const logger = createLogger("Routes:Vessel3D");

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
    try { fs.chmodSync(fallback, 0o700); } catch { /* noop */ }
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

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const orgId = (req as any).orgId || DEFAULT_ORG_ID;
        cb(null, orgDir(orgId));
      } catch (e: any) {
        cb(e, "");
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    },
  }),
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

// ---------- Upload (admin only) ----------
// Wrap multer so its errors (size, type, etc.) map to explicit 400/413
// responses instead of falling through to the global 500 handler.
function uploadSingleModel(req: Request, res: Response, next: (err?: any) => void) {
  upload.single("model")(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    if (typeof err?.message === "string") {
      return res.status(400).json({ error: err.message });
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
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const { vesselId } = req.params;
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      // Magic-byte check: GLB files start with ASCII "glTF" (0x67 0x6C 0x54 0x46).
      // Extension alone is spoofable; verify the on-disk bytes before trusting it.
      try {
        const fd = fs.openSync(file.path, "r");
        const header = Buffer.alloc(4);
        fs.readSync(fd, header, 0, 4, 0);
        fs.closeSync(fd);
        if (header.toString("ascii") !== "glTF") {
          try { fs.unlinkSync(file.path); } catch { /* noop */ }
          return res.status(400).json({ error: "File is not a valid GLB (missing glTF magic header)" });
        }
      } catch (err) {
        try { fs.unlinkSync(file.path); } catch { /* noop */ }
        return res.status(400).json({ error: "Could not read uploaded file" });
      }

      // Verify vessel belongs to org.
      const [vessel] = await db
        .select({ id: vessels.id })
        .from(vessels)
        .where(and(eq(vessels.id, vesselId), eq(vessels.orgId, orgId)));
      if (!vessel) {
        // Clean up the orphan file.
        try { fs.unlinkSync(file.path); } catch { /* noop */ }
        return res.status(404).json({ error: "Vessel not found" });
      }

      // Parse optional equipment pins from JSON body field. Reject malformed
      // input with 400 so admins notice typos instead of silently shipping
      // an empty pin set.
      let pins: EquipmentPin[] = [];
      if (typeof req.body?.equipmentPins === "string" && req.body.equipmentPins.length > 0) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(req.body.equipmentPins);
        } catch {
          try { fs.unlinkSync(file.path); } catch { /* noop */ }
          return res.status(400).json({ error: "equipmentPins is not valid JSON" });
        }
        const v = z.array(equipmentPinSchema).max(2000).safeParse(parsed);
        if (!v.success) {
          try { fs.unlinkSync(file.path); } catch { /* noop */ }
          return res.status(400).json({ error: v.error.flatten().fieldErrors });
        }
        pins = v.data;
      }

      let row;
      try {
        [row] = await db
          .insert(vessel3dModels)
          .values({
            orgId,
            vesselId,
            filename: file.originalname,
            // Canonicalise to the GLB spec mime; the uploaded mimetype is
            // advisory and varies by client. We've already verified the magic
            // header so it's safe to assert this on serve.
            mimetype: "model/gltf-binary",
            sizeBytes: file.size,
            storedPath: file.path,
            equipmentPins: pins,
          })
          .returning();
      } catch (dbErr: any) {
        // Avoid orphaning the on-disk GLB if the metadata insert fails.
        try { fs.unlinkSync(file.path); } catch { /* noop */ }
        logger.error("Vessel 3D model DB insert failed; uploaded file removed", {
          error: dbErr?.message,
          vesselId,
        });
        return res.status(500).json({ error: "Failed to persist model metadata" });
      }

      // Task #89: 3D models are stored on disk and contribute to the
      // tenant's storage_bytes quota. Increment AFTER the metadata row
      // commits so failed inserts don't pollute the counter.
      void quotaService.incrementUsage(orgId, "storage_bytes", file.size);

      res.status(201).json(row);
    } catch (error: any) {
      // Last-resort cleanup if anything above the DB insert threw unexpectedly.
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch { /* noop */ }
      }
      logger.error("Upload failed", { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

// ---------- Latest model metadata for a vessel ----------
router.get("/vessels/:vesselId/3d-model", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId || DEFAULT_ORG_ID;
    const { vesselId } = req.params;
    const [row] = await db
      .select()
      .from(vessel3dModels)
      .where(and(eq(vessel3dModels.orgId, orgId), eq(vessel3dModels.vesselId, vesselId)))
      .orderBy(desc(vessel3dModels.createdAt))
      .limit(1);
    if (!row) return res.status(404).json({ error: "No 3D model attached" });
    // Do not leak storedPath.
    const { storedPath, ...safe } = row;
    res.json(safe);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Stream binary (auth-checked) ----------
router.get("/vessels/3d-model/:modelId/binary", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId || DEFAULT_ORG_ID;
    const { modelId } = req.params;
    const [row] = await db
      .select()
      .from(vessel3dModels)
      .where(and(eq(vessel3dModels.id, modelId), eq(vessel3dModels.orgId, orgId)));
    if (!row) return res.status(404).json({ error: "Model not found" });

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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Replace equipment pins (admin only) ----------
router.patch("/vessels/3d-model/:modelId/pins", requireRole("admin", "chief_engineer"), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId || DEFAULT_ORG_ID;
    const { modelId } = req.params;
    const parsed = pinsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const [row] = await db
      .update(vessel3dModels)
      .set({ equipmentPins: parsed.data.pins, updatedAt: new Date() })
      .where(and(eq(vessel3dModels.id, modelId), eq(vessel3dModels.orgId, orgId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Model not found" });
    const { storedPath, ...safe } = row;
    res.json(safe);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Dependency graph for 3D overlay ----------
// Thin proxy over `failurePropagation` so the 3D viewer can highlight
// downstream equipment when an operator clicks a pin. Empty array when
// GRAPH_ENABLED=false (no-op adapter) — caller treats absence as "no overlay".
router.get(
  "/vessels/equipment/:equipmentId/dependencies",
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const { equipmentId } = req.params;
      const hopsParsed = z.coerce.number().int().min(1).max(5).default(3)
        .safeParse(req.query.maxHops ?? 3);
      if (!hopsParsed.success) {
        return res.status(400).json({ error: "maxHops must be an integer between 1 and 5" });
      }
      const maxHops = hopsParsed.data;
      const downstream = await failurePropagation(orgId, equipmentId, maxHops);
      res.json({ equipmentId, downstream });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export { router as vessel3dRouter };
