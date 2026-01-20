/**
 * Equipment Service - Decommission Operations
 */

import type { InsertDecommissionEvent, EquipmentDecommissionEvent } from '@shared/schema-runtime';
import { db } from '../../../db';
import { equipment, equipmentDecommissionEvents } from '@shared/schema-runtime';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { logger } from "../../../utils/logger.js";
import { recordAndPublish } from '../../../sync-events';
import { DualWriteAdapter } from '../../../infrastructure/DualWriteAdapter';
import * as crud from './crud-operations.js';

export interface DecommissionResult {
  event: EquipmentDecommissionEvent;
  equipment: {
    id: string;
    name: string;
    decommissionedAt: Date;
    decommissionStatus: string;
  };
}

export interface DecommissionedEquipmentWithEvent {
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

export async function decommissionEquipment(
  adapter: DualWriteAdapter,
  equipmentId: string,
  orgId: string,
  data: InsertDecommissionEvent
): Promise<DecommissionResult> {
  const existingEquipment = await crud.getEquipmentById(adapter, equipmentId, orgId);
  if (!existingEquipment) {
    throw new Error('Equipment not found');
  }

  if (existingEquipment.decommissionedAt) {
    throw new Error('Equipment is already decommissioned');
  }

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

  const [updatedEquipment] = await db
    .update(equipment)
    .set({
      isActive: false,
      decommissionedAt: new Date(),
      decommissionStatus: data.reason,
      decommissionEventId: decommissionEvent.id,
      updatedAt: new Date(),
    })
    .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
    .returning();

  logger.info("EquipmentDecommission", `Equipment ${equipmentId} decommissioned: ${data.reason}`);

  await recordAndPublish('equipment', equipmentId, 'update', {
    ...updatedEquipment,
    decommissioned: true,
    decommissionReason: data.reason,
  });

  return {
    event: decommissionEvent,
    equipment: {
      id: updatedEquipment.id,
      name: updatedEquipment.name,
      decommissionedAt: updatedEquipment.decommissionedAt!,
      decommissionStatus: updatedEquipment.decommissionStatus!,
    },
  };
}

export async function listDecommissionedEquipment(orgId: string): Promise<DecommissionedEquipmentWithEvent[]> {
  const decommissionedEquipment = await db
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
    .where(
      and(
        eq(equipment.orgId, orgId),
        isNotNull(equipment.decommissionedAt)
      )
    )
    .orderBy(sql`${equipment.decommissionedAt} DESC`);

  return decommissionedEquipment;
}

export async function getDecommissionEvent(
  eventId: string,
  orgId: string
): Promise<EquipmentDecommissionEvent | undefined> {
  const [event] = await db
    .select()
    .from(equipmentDecommissionEvents)
    .where(
      and(
        eq(equipmentDecommissionEvents.id, eventId),
        eq(equipmentDecommissionEvents.orgId, orgId)
      )
    );

  return event;
}

export async function getEquipmentFinancialSummary(orgId: string): Promise<{
  totalFleetValue: number;
  totalBookValue: number;
  totalCapitalRecovered: number;
  activeEquipmentCount: number;
  decommissionedCount: number;
}> {
  const allEquipment = await db
    .select({
      purchaseValue: equipment.purchaseValue,
      purchaseDate: equipment.purchaseDate,
      isActive: equipment.isActive,
      decommissionedAt: equipment.decommissionedAt,
    })
    .from(equipment)
    .where(eq(equipment.orgId, orgId));

  let decommissionEvents: { saleDetails: unknown }[] = [];
  try {
    decommissionEvents = await db
      .select({
        saleDetails: equipmentDecommissionEvents.saleDetails,
      })
      .from(equipmentDecommissionEvents)
      .where(eq(equipmentDecommissionEvents.orgId, orgId));
  } catch (error) {
    logger.warn("getEquipmentFinancialSummary", "Failed to fetch decommission events, using empty array", { error });
  }

  let totalFleetValue = 0;
  let totalBookValue = 0;
  let activeEquipmentCount = 0;
  let decommissionedCount = 0;

  const now = new Date();
  const usefulLifeYears = 10;

  for (const eq of allEquipment) {
    if (eq.isActive && !eq.decommissionedAt) {
      activeEquipmentCount++;
      if (eq.purchaseValue) {
        totalFleetValue += eq.purchaseValue;
        if (eq.purchaseDate) {
          const purchaseDate = typeof eq.purchaseDate === 'string' ? new Date(eq.purchaseDate) : eq.purchaseDate;
          const yearsOwned = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          const depreciationRate = 1 / usefulLifeYears;
          const bookValue = eq.purchaseValue * (1 - Math.min(yearsOwned * depreciationRate, 1));
          totalBookValue += Math.max(0, bookValue);
        } else {
          totalBookValue += eq.purchaseValue;
        }
      }
    } else if (eq.decommissionedAt) {
      decommissionedCount++;
    }
  }

  let totalCapitalRecovered = 0;
  for (const event of decommissionEvents) {
    if (event.saleDetails && typeof event.saleDetails === 'object') {
      const saleDetails = event.saleDetails as Record<string, unknown>;
      if (typeof saleDetails.salePrice === 'number') {
        totalCapitalRecovered += saleDetails.salePrice;
      }
    }
  }

  return {
    totalFleetValue,
    totalBookValue: Math.round(totalBookValue * 100) / 100,
    totalCapitalRecovered,
    activeEquipmentCount,
    decommissionedCount,
  };
}
