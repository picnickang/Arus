/**
 * Crew Data Adapter
 * Implements ICrewDataPort for data access
 */

import type { ICrewDataPort } from "../domain/ports.js";
import { db } from "../../../db/index.js";
import { crew } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

export class CrewDataAdapter implements ICrewDataPort {
  async findByOrgId(
    orgId: string,
    crewIds?: string[]
  ): Promise<
    Array<{
      id: string;
      name: string;
      role: string;
      status: string;
      certifications?: string[];
    }>
  > {
    const conditions = [eq(crew.orgId, orgId), eq(crew.active, true)];

    if (crewIds && crewIds.length > 0) {
      conditions.push(inArray(crew.id, crewIds));
    }

    const result = await db
      .select({
        id: crew.id,
        name: crew.name,
        role: crew.role,
        status: crew.status,
      })
      .from(crew)
      .where(and(...conditions));

    return result.map((c) => ({
      id: c.id,
      name: c.name || "Unknown",
      role: c.role || "crew",
      status: c.status || "active",
    }));
  }
}

export const crewDataAdapter = new CrewDataAdapter();
