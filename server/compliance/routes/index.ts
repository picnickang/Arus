import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Compliance:Routes:Index");
import { Router } from "express";
import { complianceAuditRouter } from "./audit-routes";
import { complianceSessionRouter } from "./session-routes";
import { complianceWorkOrderHistoryRouter } from "./work-order-history-routes";
import { complianceDataPrivacyRouter } from "./data-privacy-routes";
import { complianceMlGovernanceRouter } from "./ml-governance-routes";

const router = Router();

router.use("/", complianceAuditRouter);
router.use("/", complianceSessionRouter);
router.use("/", complianceWorkOrderHistoryRouter);
router.use("/", complianceDataPrivacyRouter);
router.use("/", complianceMlGovernanceRouter);

logger.info("[Compliance Routes] Loaded 5 modular route files");

export default router;
export {
  complianceAuditRouter,
  complianceSessionRouter,
  complianceWorkOrderHistoryRouter,
  complianceDataPrivacyRouter,
  complianceMlGovernanceRouter,
};
