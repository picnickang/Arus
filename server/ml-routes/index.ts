/**
 * ML Routes - Main Entry Point
 * Combines all ML route modules
 */

import { Router } from "express";
import { modelRoutes } from "./model-routes.js";
import { acousticRoutes } from "./acoustic-routes.js";

const router = Router();
router.use(modelRoutes);
router.use(acousticRoutes);

export const mlRouter = router;
