import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { resolveInferenceRunner } from "./model-backed-runner";
import { PredictionEngineService } from "./prediction-engine.service";
import { createLogger } from "../../../lib/structured-logger";

const router = Router();
const runner = resolveInferenceRunner();
const predictionEngine = new PredictionEngineService(runner);
const logger = createLogger("PdmInferenceRoutes");

const inferSchema = z.object({
  equipmentId: z.string().min(1),
  modelVersionId: z.string().optional(),
});

/**
 * Double-send safety: every short-circuit terminates the handler with an
 * explicit `return`, and every `catch` checks `res.headersSent` before
 * attempting an error response. Without that guard, a throw raised *after*
 * `res.json(...)` has already streamed headers (rare but possible with
 * serializer faults or destroyed sockets) would attempt a second send and
 * crash with `ERR_HTTP_HEADERS_SENT`.
 */
function sendError(res: Response, status: number, error: unknown): void {
  if (res.headersSent) {
    logger.warn("Suppressed double-send in pdm inference handler", {
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  res.status(status).json({ error: message });
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const orgId = (req as AuthenticatedRequest).orgId;
    const parsed = inferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { equipmentId, modelVersionId } = parsed.data;
    const result = await predictionEngine.predict(orgId, equipmentId, modelVersionId);
    return res.json(result);
  } catch (error) {
    return sendError(res, 500, error);
  }
});

router.get("/predictions/:predictionId/explanations", async (req: Request, res: Response) => {
  try {
    const orgId = (req as AuthenticatedRequest).orgId;
    const predictionId = parseInt(req.params['predictionId'] ?? '');
    if (isNaN(predictionId)) {
      return res.status(400).json({ error: "Invalid predictionId" });
    }
    const result = await predictionEngine.getExplanations(orgId, predictionId);
    return res.json(result);
  } catch (error) {
    return sendError(res, 500, error);
  }
});

router.get("/predictions/:predictionId/lineage", async (req: Request, res: Response) => {
  try {
    const orgId = (req as AuthenticatedRequest).orgId;
    const predictionId = parseInt(req.params['predictionId'] ?? '');
    if (isNaN(predictionId)) {
      return res.status(400).json({ error: "Invalid predictionId" });
    }
    const result = await predictionEngine.getLineage(orgId, predictionId);
    if (!result) {
      return res.status(404).json({ error: "Prediction not found" });
    }
    return res.json(result);
  } catch (error) {
    return sendError(res, 500, error);
  }
});

export { router as inferenceRouter };
