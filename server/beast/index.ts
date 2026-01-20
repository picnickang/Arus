/**
 * Beast Mode API Routes - Modular Architecture
 * 
 * Refactored from 1867-line monolith to 7 domain-specific modules:
 * - config-routes.ts (~80 lines) - Feature configuration & health
 * - vibration-routes.ts (~75 lines) - Vibration analysis
 * - lp-routes.ts (~55 lines) - LP optimization
 * - weibull-routes.ts (~80 lines) - Weibull RUL analysis
 * - trends-routes.ts (~120 lines) - Enhanced trends analysis
 * - inventory-risk-routes.ts (~70 lines) - Inventory risk analysis
 * - compliance-export-routes.ts (~140 lines) - PDF/Excel exports
 * 
 * Total: ~620 lines (67% reduction)
 */

import { Router } from "express";
import { beastConfigRouter } from "./config-routes.js";
import { beastVibrationRouter } from "./vibration-routes.js";
import { beastLPRouter } from "./lp-routes.js";
import { beastWeibullRouter } from "./weibull-routes.js";
import { beastTrendsRouter } from "./trends-routes.js";
import { beastInventoryRiskRouter } from "./inventory-risk-routes.js";
import { beastComplianceExportRouter } from "./compliance-export-routes.js";

const router = Router();

// Mount all beast mode subrouters
router.use("/", beastConfigRouter);
router.use("/", beastVibrationRouter);
router.use("/", beastLPRouter);
router.use("/", beastWeibullRouter);
router.use("/", beastTrendsRouter);
router.use("/", beastInventoryRiskRouter);
router.use("/", beastComplianceExportRouter);

console.log("[Beast Mode] Loaded 7 modular route files");

export { router as beastModeRouter };
