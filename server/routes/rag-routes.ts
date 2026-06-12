/**
 * RAG API Routes
 *
 * Compatibility facade for Retrieval-Augmented Generation endpoints.
 */

import type { Express } from "express";
import { logger } from "../utils/logger";
import { ragAuthMiddleware } from "../services/rag/security/middleware";
import { initializeRagSecurity } from "../services/rag/security";
import { registerRagAskRoutes } from "./rag-ask-routes";
import { registerRagConversationRoutes } from "./rag-conversation-routes";
import { registerRagExtendedRoutes } from "./rag-extended-routes";
import type { RagRouteRateLimiters } from "./rag-route-utils";

export function registerRagRoutes(app: Express, rateLimiters: RagRouteRateLimiters) {
  initializeRagSecurity();

  app.use("/api/rag", (req, res, next) => ragAuthMiddleware(req, res, next));
  registerRagAskRoutes(app);
  registerRagConversationRoutes(app, {
    generalApiRateLimit: rateLimiters.generalApiRateLimit,
  });
  registerRagExtendedRoutes(app, rateLimiters);

  logger.info(
    "[RAG Routes] Registered (ask, ask-stream, conversations, feedback, cache, suggestions, export, analytics, compare, alerts)"
  );
}
