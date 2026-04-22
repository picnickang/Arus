import type {
  SelectCrew,
  SelectCrewEmploymentHistory,
  InsertCrewEmploymentHistory,
} from "@shared/schema-runtime";
import { db } from "../../../db";
import { crew } from "@shared/schema";
import { crewEmploymentHistory } from "../../../../shared/schema/crew.js";
import { eq, and, sql, inArray } from "drizzle-orm";

export class CrewLifecycleRepository {
  async findCrewById(id: string, orgId: string): Promise<SelectCrew | undefined> {
    const results = await db
      .select()
      .from(crew)
      .where(and(eq(crew.id, id), eq(crew.orgId, orgId)))
      .limit(1);
    return results[0];
  }

  async findActiveCrewById(id: string, orgId: string): Promise<SelectCrew | undefined> {
    const results = await db
      .select()
      .from(crew)
      .where(and(eq(crew.id, id), eq(crew.orgId, orgId), eq(crew.active, true)))
      .limit(1);
    return results[0];
  }

  async findFormerCrewById(id: string, orgId: string): Promise<SelectCrew | undefined> {
    const results = await db
      .select()
      .from(crew)
      .where(and(eq(crew.id, id), eq(crew.orgId, orgId), eq(crew.active, false)))
      .limit(1);
    return results[0];
  }

  async findFormerCrew(orgId: string): Promise<SelectCrew[]> {
    return db
      .select()
      .from(crew)
      .where(and(eq(crew.orgId, orgId), eq(crew.active, false)));
  }

  async findFormerCrewWithHistory(orgId: string): Promise<Array<SelectCrew & { employmentPeriods: SelectCrewEmploymentHistory[] }>> {
    const formerCrewMembers = await db
      .select()
      .from(crew)
      .where(and(eq(crew.orgId, orgId), eq(crew.active, false)));

    return await Promise.all(
      formerCrewMembers.map(async (member) => {
        const periods = await db
          .select()
          .from(crewEmploymentHistory)
          .where(and(eq(crewEmploymentHistory.crewId, member.id), eq(crewEmploymentHistory.orgId, orgId)))
          .orderBy(sql`${crewEmploymentHistory.endDate} DESC`);
        return { ...member, employmentPeriods: periods };
      })
    );
  }

  async terminateCrew(
    id: string,
    orgId: string,
    terminationType: "retired" | "cancelled",
    terminationDate: Date,
    terminationNotes?: string
  ): Promise<SelectCrew> {
    const results = await db
      .update(crew)
      .set({
        active: false,
        onDuty: false,
        terminationType,
        terminationDate,
        terminationNotes,
        updatedAt: new Date(),
      })
      .where(and(eq(crew.id, id), eq(crew.orgId, orgId)))
      .returning();

    if (!results[0]) {
      throw new Error(`Crew member not found: ${id}`);
    }
    return results[0];
  }

  async reinstateCrew(
    id: string,
    orgId: string,
    startDate: Date,
    reinstatedBy?: string
  ): Promise<SelectCrew> {
    const results = await db
      .update(crew)
      .set({
        active: true,
        onDuty: false,
        startDate,
        terminationType: null,
        terminationDate: null,
        terminationNotes: null,
        reinstatedAt: new Date(),
        reinstatedBy: reinstatedBy || null,
        updatedAt: new Date(),
      })
      .where(and(eq(crew.id, id), eq(crew.orgId, orgId)))
      .returning();

    if (!results[0]) {
      throw new Error(`Crew member not found: ${id}`);
    }
    return results[0];
  }

  async createEmploymentHistory(
    data: InsertCrewEmploymentHistory
  ): Promise<SelectCrewEmploymentHistory> {
    const results = await db
      .insert(crewEmploymentHistory)
      .values(data)
      .returning();
    return results[0];
  }

  async getEmploymentHistory(crewId: string, orgId: string): Promise<SelectCrewEmploymentHistory[]> {
    return db
      .select()
      .from(crewEmploymentHistory)
      .where(and(eq(crewEmploymentHistory.crewId, crewId), eq(crewEmploymentHistory.orgId, orgId)))
      .orderBy(sql`${crewEmploymentHistory.endDate} DESC`);
  }

  async findEmploymentHistoryById(id: string, orgId: string): Promise<SelectCrewEmploymentHistory | undefined> {
    const results = await db
      .select()
      .from(crewEmploymentHistory)
      .where(and(eq(crewEmploymentHistory.id, id), eq(crewEmploymentHistory.orgId, orgId)))
      .limit(1);
    return results[0];
  }

  async updateEmploymentHistory(
    id: string,
    orgId: string,
    data: Partial<InsertCrewEmploymentHistory>
  ): Promise<SelectCrewEmploymentHistory> {
    const results = await db
      .update(crewEmploymentHistory)
      .set(data)
      .where(and(eq(crewEmploymentHistory.id, id), eq(crewEmploymentHistory.orgId, orgId)))
      .returning();
    if (!results[0]) {
      throw new Error(`Employment history record not found: ${id}`);
    }
    return results[0];
  }

  async deleteEmploymentHistory(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(crewEmploymentHistory)
      .where(and(eq(crewEmploymentHistory.id, id), eq(crewEmploymentHistory.orgId, orgId)));
    return ((result as { rowCount?: number }).rowCount ?? 0) > 0;
  }

  async bulkDeleteCrew(ids: string[], orgId: string): Promise<number> {
    if (ids.length === 0) {return 0;}

    const result = await db
      .delete(crew)
      .where(and(
        inArray(crew.id, ids),
        eq(crew.orgId, orgId),
        eq(crew.active, false)
      ));

    return (result as { rowCount?: number }).rowCount ?? 0;
  }

  async deleteFormerCrew(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(crew)
      .where(and(eq(crew.id, id), eq(crew.orgId, orgId), eq(crew.active, false)));

    return ((result as { rowCount?: number }).rowCount ?? 0) > 0;
  }
}

export const crewLifecycleRepository = new CrewLifecycleRepository();
