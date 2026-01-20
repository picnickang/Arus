/**
 * LLM Routes - Backward Compatibility Shim
 * 
 * This file delegates to the modularized routes/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/domains/llm/routes/index.ts for the modular implementation
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../storage";
import { registerLlmRoutesModular } from "./routes/index.js";

export function registerLlmRoutes(
  app: Express,
  storage: IStorage,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
    reportGenerationRateLimit: RateLimitRequestHandler;
  }
) {
  registerLlmRoutesModular(app, storage, rateLimiters);
}
