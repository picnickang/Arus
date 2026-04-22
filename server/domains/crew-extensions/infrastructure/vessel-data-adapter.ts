/**
 * Vessel Data Adapter
 * Implements IVesselDataPort for data access
 */

import type { IVesselDataPort } from "../domain/ports.js";
import { db } from "../../../db/index.js";
import { vessels } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

export class VesselDataAdapter implements IVesselDataPort {
  async findByOrgId(
    orgId: string,
    vesselIds?: string[]
  ): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      status: string;
    }>
  > {
    const conditions = [eq(vessels.orgId, orgId)];

    if (vesselIds && vesselIds.length > 0) {
      conditions.push(inArray(vessels.id, vesselIds));
    }

    const result = await db
      .select({
        id: vessels.id,
        name: vessels.name,
        type: vessels.type,
        status: vessels.status,
      })
      .from(vessels)
      .where(and(...conditions));

    return result.map((v) => ({
      id: v.id,
      name: v.name || "Unknown Vessel",
      type: v.type || "cargo",
      status: v.status || "active",
    }));
  }
}

export const vesselDataAdapter = new VesselDataAdapter();
