/**
 * STCW - Database Storage
 */

import { eq, and, gte, lte, or, inArray } from "drizzle-orm";
import { db } from "../../db-config";
import { crewRestSheet, crewRestDay } from "@shared/schema-runtime";
import type {
  SelectCrewRestSheet as CrewRestSheet,
  SelectCrewRestDay as CrewRestDay,
} from "@shared/schema";
import type { InsertCrewRestSheet, InsertCrewRestDay } from "./types.js";

export class DatabaseStcwStorage {
  async createCrewRestSheet(data: InsertCrewRestSheet): Promise<CrewRestSheet> {
    const [n] = await db.insert(crewRestSheet).values(data).returning();
    return n;
  }
  async upsertCrewRestDay(
    sheetId: string,
    dayData: Omit<InsertCrewRestDay, "sheetId"> & { date: Date | string }
  ): Promise<CrewRestDay> {
    const e = await db
      .select()
      .from(crewRestDay)
      .where(and(eq(crewRestDay.sheetId, sheetId), eq(crewRestDay.date, dayData.date)))
      .limit(1);
    if (e.length > 0) {
      const [u] = await db
        .update(crewRestDay)
        .set(dayData)
        .where(and(eq(crewRestDay.sheetId, sheetId), eq(crewRestDay.date, dayData.date)))
        .returning();
      return u;
    }
    const [inserted] = await db
      .insert(crewRestDay)
      .values({ sheetId, ...dayData })
      .returning();
    return inserted;
  }
  async getCrewRestMonth(
    crewId: string,
    year: number,
    month: string
  ): Promise<{ sheet: CrewRestSheet | null; days: CrewRestDay[] }> {
    const [sheet] = await db
      .select()
      .from(crewRestSheet)
      .where(
        and(
          eq(crewRestSheet.crewId, crewId),
          eq(crewRestSheet.year, year),
          eq(crewRestSheet.month, month)
        )
      )
      .limit(1);
    if (!sheet) {
      return { sheet: null, days: [] };
    }
    const days = await db
      .select()
      .from(crewRestDay)
      .where(eq(crewRestDay.sheetId, sheet.id))
      .orderBy(crewRestDay.date);
    return { sheet, days };
  }
  async getCrewRestRange(
    crewId: string,
    startDate: string,
    endDate: string
  ): Promise<{ sheets: CrewRestSheet[]; days: CrewRestDay[] }> {
    const startYear = Number.parseInt(startDate.substring(0, 4));
    const startMonth = Number.parseInt(startDate.substring(5, 7));
    const endYear = Number.parseInt(endDate.substring(0, 4));
    const endMonth = Number.parseInt(endDate.substring(5, 7));
    const monthConditions = [];
    for (let year = startYear; year <= endYear; year++) {
      const mStart = year === startYear ? startMonth : 1;
      const mEnd = year === endYear ? endMonth : 12;
      for (let m = mStart; m <= mEnd; m++) {
        const monthName = new Date(year, m - 1)
          .toLocaleString("en-US", { month: "long" })
          .toUpperCase();
        monthConditions.push(
          and(
            eq(crewRestSheet.crewId, crewId),
            eq(crewRestSheet.year, year),
            eq(crewRestSheet.month, monthName)
          )
        );
      }
    }
    const sheets =
      monthConditions.length > 0
        ? await db
            .select()
            .from(crewRestSheet)
            .where(or(...monthConditions))
        : [];
    if (sheets.length === 0) {
      return { sheets: [], days: [] };
    }
    const sheetIds = sheets.map((s) => s.id);
    const days = await db
      .select()
      .from(crewRestDay)
      .where(
        and(
          inArray(crewRestDay.sheetId, sheetIds),
          gte(crewRestDay.date, startDate),
          lte(crewRestDay.date, endDate)
        )
      )
      .orderBy(crewRestDay.date);
    return { sheets, days };
  }
  async getMultipleCrewRest(
    crewIds: string[],
    year: number,
    month: string
  ): Promise<{ [crewId: string]: { sheet: CrewRestSheet | null; days: CrewRestDay[] } }> {
    const result: { [crewId: string]: { sheet: CrewRestSheet | null; days: CrewRestDay[] } } = {};
    for (const crewId of crewIds) {
      result[crewId] = { sheet: null, days: [] };
    }
    if (crewIds.length === 0) {
      return result;
    }
    const sheets = await db
      .select()
      .from(crewRestSheet)
      .where(
        and(
          inArray(crewRestSheet.crewId, crewIds),
          eq(crewRestSheet.year, year),
          eq(crewRestSheet.month, month)
        )
      );
    const sheetIds = sheets.map((s) => s.id);
    const allDays =
      sheetIds.length > 0
        ? await db
            .select()
            .from(crewRestDay)
            .where(inArray(crewRestDay.sheetId, sheetIds))
            .orderBy(crewRestDay.date)
        : [];
    for (const sheet of sheets) {
      result[sheet.crewId!] = { sheet, days: allDays.filter((d) => d.sheetId === sheet.id) };
    }
    return result;
  }
  async getCrewRestSheets(year: number, month: string, orgId?: string): Promise<CrewRestSheet[]> {
    const conditions = [eq(crewRestSheet.year, year), eq(crewRestSheet.month, month)];
    if (orgId) {
      conditions.push(eq(crewRestSheet.orgId, orgId));
    }
    return db
      .select()
      .from(crewRestSheet)
      .where(and(...conditions));
  }
  async bulkCreateRestDays(
    sheetId: string,
    days: Omit<InsertCrewRestDay, "sheetId">[]
  ): Promise<CrewRestDay[]> {
    if (days.length === 0) {
      return [];
    }
    const values = days.map((d) => ({ sheetId, ...d }));
    return db.insert(crewRestDay).values(values).returning();
  }
}
