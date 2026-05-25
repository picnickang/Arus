/**
 * Work Order Enriched Parts Routes
 *
 * Provides enriched parts data with stock status, delivery estimates, and out-of-stock suggestions.
 */

import type { Express, Request, Response } from "express";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import {
  getEnrichedWorkOrderParts,
  getOutOfStockSuggestions,
} from "../services/parts-enrichment.js";

export function registerEnrichedPartsRoutes(app: Express) {
  app.get(
    "/api/work-orders/:id/parts/enriched",
    requireOrgId,
    withErrorHandling("fetch enriched work order parts", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const parts = await getEnrichedWorkOrderParts(req.params['id'] ?? '', orgId);
      res.json(parts);
    })
  );

  app.get(
    "/api/work-orders/:id/parts/out-of-stock-suggestions",
    requireOrgId,
    withErrorHandling("fetch out-of-stock suggestions", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const suggestions = await getOutOfStockSuggestions(req.params['id'] ?? '', orgId);
      res.json(suggestions);
    })
  );
}
