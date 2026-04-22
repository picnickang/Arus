/**
 * Crew Repository - Modular Aggregator
 */

import { DbCrewMembers } from "./db-members.js";
import { DbCrewExtended } from "./db-extended.js";

export * from "./types.js";
export { DbCrewMembers } from "./db-members.js";
export { DbCrewExtended } from "./db-extended.js";

export class DatabaseCrewStorage extends DbCrewMembers {
  private extended = new DbCrewExtended();
  async getCrewAssignments(orgId?: string, filters?: any) {
    return this.extended.getCrewAssignments(orgId, filters);
  }
  async getCrewAssignment(id: string, orgId?: string) {
    return this.extended.getCrewAssignment(id, orgId);
  }
  async createCrewAssignment(assignment: any) {
    return this.extended.createCrewAssignment(assignment);
  }
  async updateCrewAssignment(id: string, updates: any, orgId?: string) {
    return this.extended.updateCrewAssignment(id, updates, orgId);
  }
  async deleteCrewAssignment(id: string, orgId?: string) {
    return this.extended.deleteCrewAssignment(id, orgId);
  }
  async createBulkCrewAssignments(assignments: any[]) {
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
  async createCrewCertification(cert: any) {
    return this.extended.createCrewCertification(cert);
  }
  async updateCrewCertification(id: string, updates: any, orgId?: string) {
    return this.extended.updateCrewCertification(id, updates, orgId);
  }
  async deleteCrewCertification(id: string, orgId?: string) {
    return this.extended.deleteCrewCertification(id, orgId);
  }
  async getExpiringCertifications(days?: number, orgId?: string) {
    return this.extended.getExpiringCertifications(days, orgId);
  }
  async getCrewLeave(crewId?: string, orgId?: string) {
    return this.extended.getCrewLeave(crewId, orgId);
  }
  async createCrewLeave(leave: any) {
    return this.extended.createCrewLeave(leave);
  }
  async updateCrewLeave(id: string, updates: any, orgId?: string) {
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

console.log("[Crew Repository] Loaded 6 modular files");
