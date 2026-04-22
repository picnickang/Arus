import type {
  Equipment,
  EquipmentDecommissionEvent,
  InsertDecommissionEvent,
  DecommissionStatus,
} from "@shared/schema";
import { db } from "../../../db";
import { equipment } from "@shared/schema";
import { equipmentDecommissionEvents } from "@shared/schema/equipment";
import { eq, and, sql } from "drizzle-orm";

export class EquipmentLifecycleRepository {
  async findEquipmentById(id: string, orgId: string): Promise<Equipment | undefined> {
    const results = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, id), eq(equipment.orgId, orgId)))
      .limit(1);
    return results[0];
  }

  async findActiveEquipmentById(id: string, orgId: string): Promise<Equipment | undefined> {
    const results = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, id), eq(equipment.orgId, orgId), eq(equipment.isActive, true)))
      .limit(1);
    return results[0];
  }

  async findDecommissionedEquipmentById(id: string, orgId: string): Promise<Equipment | undefined> {
    const results = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, id), eq(equipment.orgId, orgId), eq(equipment.isActive, false)))
      .limit(1);
    return results[0];
  }

  async findDecommissionedEquipment(orgId: string): Promise<Equipment[]> {
    return db
      .select()
      .from(equipment)
      .where(and(eq(equipment.orgId, orgId), eq(equipment.isActive, false)));
  }

  async findDecommissionedEquipmentWithHistory(
    orgId: string
  ): Promise<Array<Equipment & { decommissionEvents: EquipmentDecommissionEvent[] }>> {
    const decommissionedEquipment = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.orgId, orgId), eq(equipment.isActive, false)));

    return await Promise.all(
      decommissionedEquipment.map(async (item) => {
        const events = await db
          .select()
          .from(equipmentDecommissionEvents)
          .where(
            and(
              eq(equipmentDecommissionEvents.equipmentId, item.id),
              eq(equipmentDecommissionEvents.orgId, orgId)
            )
          )
          .orderBy(sql`${equipmentDecommissionEvents.eventDate} DESC`);
        return { ...item, decommissionEvents: events };
      })
    );
  }

  async decommissionEquipment(
    id: string,
    orgId: string,
    decommissionStatus: DecommissionStatus,
    decommissionedAt: Date,
    decommissionedBy: string,
    decommissionEventId?: string
  ): Promise<Equipment> {
    const results = await db
      .update(equipment)
      .set({
        isActive: false,
        decommissionStatus,
        decommissionedAt,
        decommissionedBy,
        decommissionEventId,
        reinstatedAt: null,
        reinstatedBy: null,
        updatedAt: new Date(),
      })
      .where(and(eq(equipment.id, id), eq(equipment.orgId, orgId)))
      .returning();

    if (!results[0]) {
      throw new Error(`Equipment not found: ${id}`);
    }
    return results[0];
  }

  async reinstateEquipment(id: string, orgId: string, reinstatedBy: string): Promise<Equipment> {
    const results = await db
      .update(equipment)
      .set({
        isActive: true,
        decommissionStatus: "active",
        decommissionedAt: null,
        decommissionedBy: null,
        decommissionEventId: null,
        reinstatedAt: new Date(),
        reinstatedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(equipment.id, id), eq(equipment.orgId, orgId)))
      .returning();

    if (!results[0]) {
      throw new Error(`Equipment not found: ${id}`);
    }
    return results[0];
  }

  async createDecommissionEvent(
    data: InsertDecommissionEvent
  ): Promise<EquipmentDecommissionEvent> {
    const results = await db.insert(equipmentDecommissionEvents).values(data).returning();
    return results[0];
  }

  async getDecommissionHistory(
    equipmentId: string,
    orgId: string
  ): Promise<EquipmentDecommissionEvent[]> {
    return db
      .select()
      .from(equipmentDecommissionEvents)
      .where(
        and(
          eq(equipmentDecommissionEvents.equipmentId, equipmentId),
          eq(equipmentDecommissionEvents.orgId, orgId)
        )
      )
      .orderBy(sql`${equipmentDecommissionEvents.eventDate} DESC`);
  }

  async findDecommissionEventById(
    id: string,
    orgId: string
  ): Promise<EquipmentDecommissionEvent | undefined> {
    const results = await db
      .select()
      .from(equipmentDecommissionEvents)
      .where(
        and(eq(equipmentDecommissionEvents.id, id), eq(equipmentDecommissionEvents.orgId, orgId))
      )
      .limit(1);
    return results[0];
  }
}

export const equipmentLifecycleRepository = new EquipmentLifecycleRepository();
