/**
 * Crew Service
 * Encapsulates crew management logic including WebSocket broadcasting and cascade deletes
 */

import { dbCrewStorage } from "../../db/crew/index.js";
import { getWebSocketServer } from "../../websocket-server";
import { db } from "../../db-config";
import { crew, crewSkill, crewLeave, crewAssignment, crewCertification, crewRestSheet, crewRestDay, vessels } from "@shared/schema-runtime";
import { eq } from "drizzle-orm";
import type { Crew as SelectCrew, InsertCrew, Crew as CrewWithSkills, CrewSkill as SelectCrewSkill, CrewLeave as SelectCrewLeave, InsertCrewLeave, CrewAssignment as SelectCrewAssignment, InsertCrewAssignment } from "@shared/schema";

class CrewService {
  async getCrew(orgId?: string, vesselId?: string): Promise<CrewWithSkills[]> {
    return dbCrewStorage.getCrew(orgId, vesselId);
  }
  async getCrewMember(id: string, orgId?: string): Promise<SelectCrew | undefined> {
    return dbCrewStorage.getCrewMember(id, orgId);
  }
  async createCrew(crewData: InsertCrew): Promise<SelectCrew> {
    if (!crewData.vesselId) {
      throw new Error("vessel_id is required for crew creation");
    }
    const vessel = await db.select({ id: vessels.id }).from(vessels).where(eq(vessels.id, crewData.vesselId)).limit(1);
    if (vessel.length === 0) {
      throw new Error("vessel not found");
    }
    const newCrew = await dbCrewStorage.createCrew(crewData);
    const wsServer = getWebSocketServer();
    wsServer?.broadcastCrewChange("create", newCrew);
    return newCrew;
  }
  async updateCrew(id: string, crewData: Partial<InsertCrew>): Promise<SelectCrew> {
    const updated = await dbCrewStorage.updateCrew(id, crewData);
    const wsServer = getWebSocketServer();
    wsServer?.broadcastCrewChange("update", updated);
    return updated;
  }
  async deleteCrew(id: string): Promise<void> {
    return db.transaction(async (tx) => {
      const crewToDelete = await tx.select().from(crew).where(eq(crew.id, id)).limit(1);
      if (crewToDelete.length === 0) { throw new Error(`Crew member ${id} not found`); }
      await tx.delete(crewSkill).where(eq(crewSkill.crewId, id));
      await tx.delete(crewLeave).where(eq(crewLeave.crewId, id));
      await tx.delete(crewAssignment).where(eq(crewAssignment.crewId, id));
      await tx.delete(crewCertification).where(eq(crewCertification.crewId, id));
      const restSheets = await tx.select({ id: crewRestSheet.id }).from(crewRestSheet).where(eq(crewRestSheet.crewId, id));
      for (const sheet of restSheets) {
        await tx.delete(crewRestDay).where(eq(crewRestDay.sheetId, sheet.id));
      }
      await tx.delete(crewRestSheet).where(eq(crewRestSheet.crewId, id));
      await tx.delete(crew).where(eq(crew.id, id));
      const wsServer = getWebSocketServer();
      if (crewToDelete.length > 0) { wsServer?.broadcastCrewChange("delete", { id: crewToDelete[0].id }); }
    });
  }
  async setCrewSkill(crewId: string, skill: string, level: number): Promise<SelectCrewSkill> {
    return dbCrewStorage.setCrewSkill(crewId, skill, level);
  }
  async getCrewSkills(crewId: string): Promise<SelectCrewSkill[]> {
    return dbCrewStorage.getCrewSkills(crewId);
  }
  async deleteCrewSkill(crewId: string, skill: string): Promise<void> {
    return dbCrewStorage.deleteCrewSkill(crewId, skill);
  }
  async getCrewLeave(crewId?: string, dateFrom?: Date, dateTo?: Date): Promise<SelectCrewLeave[]> {
    return dbCrewStorage.getCrewLeave(crewId, dateFrom, dateTo);
  }
  async createCrewLeave(leaveData: InsertCrewLeave): Promise<SelectCrewLeave> {
    return dbCrewStorage.createCrewLeave(leaveData);
  }
  async updateCrewLeave(id: string, leaveData: Partial<InsertCrewLeave>): Promise<SelectCrewLeave> {
    return dbCrewStorage.updateCrewLeave(id, leaveData);
  }
  async deleteCrewLeave(id: string): Promise<void> {
    return dbCrewStorage.deleteCrewLeave(id);
  }
  async getCrewAssignments(crewId?: string, vesselId?: string, dateFrom?: Date): Promise<SelectCrewAssignment[]> {
    return dbCrewStorage.getCrewAssignments(crewId, vesselId, dateFrom);
  }
  async createCrewAssignment(assignmentData: InsertCrewAssignment): Promise<SelectCrewAssignment> {
    return dbCrewStorage.createCrewAssignment(assignmentData);
  }
  async updateCrewAssignment(id: string, assignmentData: Partial<InsertCrewAssignment>): Promise<SelectCrewAssignment> {
    return dbCrewStorage.updateCrewAssignment(id, assignmentData);
  }
  async deleteCrewAssignment(id: string): Promise<void> {
    return dbCrewStorage.deleteCrewAssignment(id);
  }
}

export const crewService = new CrewService();
