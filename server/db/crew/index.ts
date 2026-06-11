import type { WidenPartial } from "../../lib/widen-partial";
/**
 * CANONICAL HOME — Crew
 * ============================================================
 * This module is the single canonical home for Crew data
 * access. Other layers (domain adapters under
 * `server/domains/crew/infrastructure/`, legacy route handlers,
 * cross-domain readers in `server/composition/*`, etc.) MUST import
 * the `db…Storage` singleton from this file directly rather than
 * routing through `server/repositories.ts`. Push B4 (Repositories
 * Proxy Decomposition) removed the four primary-domain importers of
 * that proxy; the proxy now exists only as a transitional re-export
 * barrel for legacy non-domain consumers. New code MUST import from
 * here.
 * ============================================================
 */
/**
 * Crew Repository - Modular Aggregator
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Crew:Index");
import { DbCrewMembers } from "./db-members.js";
import { DbCrewExtended } from "./db-extended.js";
import type {
  InsertCrewAssignment,
  InsertCrewCertification,
  InsertCrewLeave,
} from "@shared/schema";
import type { CrewAssignmentFilters } from "./types.js";

export * from "./types.js";
export { DbCrewMembers } from "./db-members.js";
export { DbCrewExtended } from "./db-extended.js";

export class DatabaseCrewStorage extends DbCrewMembers {
  private extended = new DbCrewExtended();
  async getCrewAssignments(orgId?: string, filters?: CrewAssignmentFilters) {
    return this.extended.getCrewAssignments(orgId, filters);
  }
  async getCrewAssignment(id: string, orgId?: string) {
    return this.extended.getCrewAssignment(id, orgId);
  }
  async createCrewAssignment(assignment: InsertCrewAssignment) {
    return this.extended.createCrewAssignment(assignment);
  }
  async updateCrewAssignment(
    id: string,
    updates: WidenPartial<InsertCrewAssignment>,
    orgId?: string
  ) {
    return this.extended.updateCrewAssignment(id, updates, orgId);
  }
  async deleteCrewAssignment(id: string, orgId?: string) {
    return this.extended.deleteCrewAssignment(id, orgId);
  }
  async createBulkCrewAssignments(assignments: InsertCrewAssignment[]) {
    return this.extended.createBulkCrewAssignments(assignments);
  }
  async getCrewAssignmentsByDateRange(from: Date, to: Date, orgId?: string) {
    return this.extended.getCrewAssignmentsByDateRange(from, to, orgId);
  }
  async deleteCrewAssignmentsByRunId(orgId: string, runId: string) {
    return this.extended.deleteCrewAssignmentsByRunId(orgId, runId);
  }
  async getCrewCertifications(crewId?: string, orgId?: string) {
    return this.extended.getCrewCertifications(crewId, orgId);
  }
  async createCrewCertification(cert: InsertCrewCertification) {
    return this.extended.createCrewCertification(cert);
  }
  async updateCrewCertification(
    id: string,
    updates: WidenPartial<InsertCrewCertification>,
    orgId?: string
  ) {
    return this.extended.updateCrewCertification(id, updates, orgId);
  }
  async deleteCrewCertification(id: string, orgId?: string) {
    return this.extended.deleteCrewCertification(id, orgId);
  }
  async getExpiringCertifications(days?: number, orgId?: string) {
    return this.extended.getExpiringCertifications(days, orgId);
  }
  async getCrewComplianceRows(orgId: string, vesselIds: string[] | null, expiresBefore: Date) {
    return this.extended.getCrewComplianceRows(orgId, vesselIds, expiresBefore);
  }
  async getCrewLeave(crewId?: string, orgId?: string) {
    return this.extended.getCrewLeave(crewId, orgId);
  }
  async createCrewLeave(leave: InsertCrewLeave) {
    return this.extended.createCrewLeave(leave);
  }
  async updateCrewLeave(id: string, updates: WidenPartial<InsertCrewLeave>, orgId?: string) {
    return this.extended.updateCrewLeave(id, updates, orgId);
  }
  async deleteCrewLeave(id: string, orgId?: string) {
    return this.extended.deleteCrewLeave(id, orgId);
  }
  async getActiveCrewOnVessel(vesselId: string, date: Date, orgId: string) {
    return this.extended.getActiveCrewOnVessel(vesselId, date, orgId);
  }
}

export const dbCrewStorage = new DatabaseCrewStorage();

logger.info("[Crew Repository] Loaded 6 modular files");
