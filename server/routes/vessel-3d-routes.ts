/**
 * Push A3 — 3D Digital Twin Viewer routes.
 *
 * - POST  /api/v1/vessels/:vesselId/3d-model    — upload glTF/glb (admin)
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

const logger = createLogger("Routes:Vessel3D");

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const ALLOWED_EXT = new Set([".gltf", ".glb"]);
const ALLOWED_MIME = new Set([
  "model/gltf+json",
  "model/gltf-binary",
  "application/octet-stream", // common for .glb
  "application/json", // common for .gltf
]);

const STORAGE_BASE = (() => {
  const preferred = path.join(process.cwd(), ".data", "vessel-3d");
  try {
    fs.mkdirSync(preferred, { recursive: true, mode: 0o700 });
    return preferred;
  } catch {
    const fallback = "/tmp/vessel-3d";
    fs.mkdirSync(fallback, { recursive: true });
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
      return cb(new Error("Only .gltf or .glb files are allowed"));
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
router.post(
  "/vessels/:vesselId/3d-model",
  requireRole("admin", "chief_engineer"),
  upload.single("model"),
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const { vesselId } = req.params;
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

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

      // Parse optional equipment pins from JSON body field.
      let pins: EquipmentPin[] = [];
      if (typeof req.body?.equipmentPins === "string") {
        try {
          const parsed: unknown = JSON.parse(req.body.equipmentPins);
          const v = z.array(equipmentPinSchema).max(2000).safeParse(parsed);
          if (v.success) pins = v.data;
        } catch {
          // ignore malformed pins on initial upload
        }
      }

      const [row] = await db
        .insert(vessel3dModels)
        .values({
          orgId,
          vesselId,
          filename: file.originalname,
          mimetype: file.mimetype,
          sizeBytes: file.size,
          storedPath: file.path,
          equipmentPins: pins,
        })
        .returning();

      res.status(201).json(row);
    } catch (error: any) {
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
    res.setHeader("Content-Type", row.mimetype || "application/octet-stream");
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
      const maxHops = Math.max(1, Math.min(5, Number(req.query.maxHops ?? 3)));
      const downstream = await failurePropagation(orgId, equipmentId, maxHops);
      res.json({ equipmentId, downstream });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export { router as vessel3dRouter };
