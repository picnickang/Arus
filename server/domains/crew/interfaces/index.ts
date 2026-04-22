/**
 * Crew Routes - Index Aggregator
 * Combines all modular crew route handlers
 *
 * Modularized into 8 files:
 * - types.ts (~28 lines): Shared interfaces and helpers
 * - crew-member-routes.ts (~95 lines): Crew member CRUD
 * - skills-routes.ts (~115 lines): Skills and crew-skill assignments
 * - leave-routes.ts (~85 lines): Leave management
 * - assignment-routes.ts (~95 lines): Crew assignments
 * - certification-routes.ts (~175 lines): Certifications and expiry alerts
 * - document-routes.ts (~195 lines): Documents and expiry alerts
 * - notification-routes.ts (~105 lines): Notification settings
 */

import type { Express } from "express";
import type { RateLimitMiddleware, CrewRouteDeps } from "./types.js";
import { registerCrewMemberRoutes } from "./crew-member-routes.js";
import { registerSkillsRoutes } from "./skills-routes.js";
import { registerLeaveRoutes } from "./leave-routes.js";
import { registerAssignmentRoutes } from "./assignment-routes.js";
import { registerCertificationRoutes } from "./certification-routes.js";
import { registerDocumentRoutes } from "./document-routes.js";
import { registerNotificationRoutes } from "./notification-routes.js";
import crewLifecycleRoutes from "./crew-lifecycle-routes.js";
import { logger } from "../../../utils/logger.js";

export type { RateLimitMiddleware, CrewRouteDeps };
export { getExpiryUrgencyLevel } from "./types.js";

export function registerCrewRoutes(app: Express, rateLimit: RateLimitMiddleware): void {
  const deps: CrewRouteDeps = { app, rateLimit };

  // IMPORTANT: Lifecycle routes MUST be registered FIRST
  // because they include static paths like /former that would otherwise
  // be matched by /:id in crew-member-routes
  app.use("/api/crew", crewLifecycleRoutes);

  registerCrewMemberRoutes(deps);
  registerSkillsRoutes(deps);
  registerLeaveRoutes(deps);
  registerAssignmentRoutes(deps);
  registerCertificationRoutes(deps);
  registerDocumentRoutes(deps);
  registerNotificationRoutes(deps);

  logger.info(
    "CrewRoutes",
    "Registered (members: 5, skills: 5, leave: 4, assignments: 4, certs: 6, docs: 6, notifications: 3, lifecycle: 7)"
  );
}

export {
  registerCrewMemberRoutes,
  registerSkillsRoutes,
  registerLeaveRoutes,
  registerAssignmentRoutes,
  registerCertificationRoutes,
  registerDocumentRoutes,
  registerNotificationRoutes,
};
