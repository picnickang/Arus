/**
 * PdM Health — per-equipment health snapshot.
 *
 * Implements GET /api/pdm/health/:equipmentId, the endpoint the PdM
 * equipment-detail page (client/src/pages/pdm-equipment-detail.tsx via
 * usePdmEquipmentDetailData) has queried since its introduction. It was
 * documented in swagger/paths-pdm.ts but never implemented, so the page
 * crashed parsing Vite's HTML 404 fallback before any chart rendered.
 *
 * Response matches the client's PdmHealthData contract exactly. Data is
 * assembled from the same sources the analytics routes already use
 * (equipment healthIndex + pdm_score_logs); when no ML score exists the
 * endpoint degrades gracefully (status "unknown", rul null, confidence
 * "low") instead of failing — the page must render for equipment that
 * has telemetry but no model coverage yet.
 */

import { Router, type Request, type Response } from "express";
import { dbEquipmentStorage, dbDevicesStorage } from "../../../repositories";

const router = Router();

interface PdmHealthResponse {
  equipmentId: string;
  healthScore: number;
  rul: number | null;
  rulUncertainty: number | null;
  status: "healthy" | "warning" | "critical" | "unknown";
  pFail30d: number;
  aiSummary: string | null;
  lastUpdated: string;
  confidence: "high" | "medium" | "low";
}

function mapStatus(status: string | null | undefined): PdmHealthResponse["status"] {
  if (status === "healthy" || status === "warning" || status === "critical") {
    return status;
  }
  return "unknown";
}

function remainingDays(predictedDueDate: Date | null | undefined): number | null {
  if (!predictedDueDate) {
    return null;
  }
  const ms = new Date(predictedDueDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function confidenceFromPFail(pFail30d: number | null | undefined): PdmHealthResponse["confidence"] {
  if (pFail30d == null) {
    return "low";
  }
  // Same shape as the analytics RUL route: confidence = max(0.5, 1 - p*0.5).
  const numeric = Math.max(0.5, 1 - pFail30d * 0.5);
  if (numeric >= 0.85) {
    return "high";
  }
  if (numeric >= 0.65) {
    return "medium";
  }
  return "low";
}

router.get("/:equipmentId", async (req: Request, res: Response) => {
  try {
    const equipmentId = req.params["equipmentId"];
    const orgId = (req as Request & { orgId?: string }).orgId;
    if (!equipmentId || !orgId) {
      return res.status(400).json({ message: "equipmentId and org context are required" });
    }

    const [healthRows, pdmScores] = await Promise.all([
      dbEquipmentStorage.getEquipmentHealth(orgId, { equipmentId }),
      dbDevicesStorage.getPdmScores(equipmentId, orgId),
    ]);

    const equipmentHealth = healthRows.find((eq) => eq.id === equipmentId);
    if (!equipmentHealth) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    // Newest score wins; getPdmScores ordering is not guaranteed here.
    const latestScore = [...pdmScores].sort(
      (a, b) => new Date(b.ts ?? 0).getTime() - new Date(a.ts ?? 0).getTime()
    )[0];

    const healthScore = equipmentHealth.healthIndex ?? latestScore?.healthIdx ?? 100;
    const rul = remainingDays(latestScore?.predictedDueDate);
    const response: PdmHealthResponse = {
      equipmentId,
      healthScore,
      rul,
      // ±20% of the point estimate when a prediction exists — pdm_score_logs
      // carries no interval today, and the UI renders this as "± N days".
      rulUncertainty: rul == null ? null : Math.round(rul * 0.2),
      status:
        latestScore || equipmentHealth.healthIndex != null
          ? mapStatus(equipmentHealth.status)
          : "unknown",
      pFail30d: latestScore?.pFail30d ?? 0,
      aiSummary: null,
      lastUpdated: (latestScore?.ts ? new Date(latestScore.ts) : new Date()).toISOString(),
      confidence: confidenceFromPFail(latestScore?.pFail30d),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ message });
  }
});

export { router as pdmHealthRouter };
