/**
 * Purchasing API Routes
 * Aggregates all purchasing-related routes
 */

import { Router } from "express";
import { prRouter } from "./pr-routes";
import { supplierLinkRouter } from "./supplier-routes";
import poRoutes from "./po-routes";

const router = Router();

router.use(prRouter);
router.use(supplierLinkRouter);
router.use("/purchase-orders", poRoutes);

export default router;
export { router as purchasingRouter };
