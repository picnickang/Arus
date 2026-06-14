/**
 * Equipment Infrastructure - Decommission Operations Repository
 *
 * Holds the raw db access for the equipment-service decommission flows
 * (decommission events + equipment deactivation/financials). This is the only
 * place these queries touch the db handle; the service layer orchestrates over
 * these methods. SQL is moved verbatim from service/decommission-operations.ts.
 */

import type { InsertDecommissionEvent, EquipmentDecommissionEvent } from "@shared/schema";
import { db } from "../../../db";
import { equipment, equipmentDecommissionEvents } from "@shared/schema-runtime";
import { eq, and, isNotNull, sql } from "drizzle-orm";

export interface DecommissionedEquipmentRow {
  equipment: {
    id: string;
    name: string;
    type: string;
    manufacturer: string | null;
    model: string | null;
    vesselName: string | null;
    purchaseValue: number | null;
    decommissionedAt: Date | null;
  };
  event: EquipmentDecommissionEvent | null;
}

export interface EquipmentFinancialRow {
  purchaseValue: number | null;
  purchaseDate: Date | string | null;
  isActive: boolean | null;
  decommissionedAt: Date | null;
}

export class EquipmentDecommissionRepository {
  async insertDecommissionEvent(
    orgId: string,
    equipmentId: string,
    data: InsertDecommissionEvent
  ): Promise<EquipmentDecommissionEvent> {
    const [decommissionEvent] = await db
      .insert(equipmentDecommissionEvents)
      .values({
        orgId,
        equipmentId,
        reason: data.reason,
        eventDate: data.eventDate,
        authorizedBy: data.authorizedBy,
        finalCondition: data.finalCondition,
        notes: data.notes,
        saleDetails: data.saleDetails,
        disposalDetails: data.disposalDetails,
        replacementEquipmentId: data.replacementEquipmentId,
        bookValueAtRemoval: data.bookValueAtRemoval,
        residualValue: data.residualValue,
        documentationRefs: data.documentationRefs,
      })
      .returning();
    if (!decommissionEvent) {
      throw new Error("decommissionEquipment: event insert returned no row");
    }
    return decommissionEvent;
  }

  async deactivateEquipment(
    orgId: string,
    equipmentId: string,
    decommissionStatus: string,
    decommissionEventId: string
  ): Promise<{ id: string; name: string; decommissionedAt: Date | null; decommissionStatus: string | null }> {
    const [updatedEquipment] = await db
      .update(equipment)
      .set({
        isActive: false,
        decommissionedAt: new Date(),
        decommissionStatus,
        decommissionEventId,
        updatedAt: new Date(),
      })
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .returning();
    if (!updatedEquipment) {
      throw new Error(`decommissionEquipment: equipment ${equipmentId} update returned no row`);
    }
    return updatedEquipment;
  }

  async listDecommissionedWithEvents(orgId: string): Promise<DecommissionedEquipmentRow[]> {
    return db
      .select({
        equipment: {
          id: equipment.id,
          name: equipment.name,
          type: equipment.type,
          manufacturer: equipment.manufacturer,
          model: equipment.model,
          vesselName: equipment.vesselName,
          purchaseValue: equipment.purchaseValue,
          decommissionedAt: equipment.decommissionedAt,
        },
        event: equipmentDecommissionEvents,
      })
      .from(equipment)
      .leftJoin(
        equipmentDecommissionEvents,
        eq(equipment.decommissionEventId, equipmentDecommissionEvents.id)
      )
      .where(and(eq(equipment.orgId, orgId), isNotNull(equipment.decommissionedAt)))
      .orderBy(sql`${equipment.decommissionedAt} DESC`);
  }

  async getDecommissionEventById(
    eventId: string,
    orgId: string
  ): Promise<EquipmentDecommissionEvent | undefined> {
    const [event] = await db
      .select()
      .from(equipmentDecommissionEvents)
      .where(
        and(eq(equipmentDecommissionEvents.id, eventId), eq(equipmentDecommissionEvents.orgId, orgId))
      );
    return event;
  }

  async getEquipmentForFinancials(orgId: string): Promise<EquipmentFinancialRow[]> {
    return db
      .select({
        purchaseValue: equipment.purchaseValue,
        purchaseDate: equipment.purchaseDate,
        isActive: equipment.isActive,
        decommissionedAt: equipment.decommissionedAt,
      })
      .from(equipment)
      .where(eq(equipment.orgId, orgId));
  }

  async getDecommissionSaleDetails(orgId: string): Promise<{ saleDetails: unknown }[]> {
    return db
      .select({ saleDetails: equipmentDecommissionEvents.saleDetails })
      .from(equipmentDecommissionEvents)
      .where(eq(equipmentDecommissionEvents.orgId, orgId));
  }
}

export const equipmentDecommissionRepository = new EquipmentDecommissionRepository();
