/**
 * Compliance API Routes - Modular Architecture
 * 
 * This file re-exports the modular compliance routes for backward compatibility.
 * Routes are now organized into domain-specific modules:
 * - audit-routes.ts: Audit trail queries, verification, reports
 * - session-routes.ts: Session management, login events
 * - work-order-history-routes.ts: Work order history verification
 * - data-privacy-routes.ts: DSAR, anonymization, export
 * - ml-governance-routes.ts: ML overrides, provenance
 */

import complianceRouter from './routes/index';

export default complianceRouter;
