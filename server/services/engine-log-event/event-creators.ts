/**
 * Engine Log Event - Event Creators
 */

import { engineLogStorage } from '../../repositories';
import type { FuelEventDetails } from './types.js';
import { ENGINE_LOG_EVENT_TYPES, ENGINE_LOG_EVENT_SOURCES } from './types.js';
import { ensureEngineLogDay, createIdempotencyKey } from './helpers.js';

export async function createWorkOrderEngineEvent(workOrderId: string, vesselId: string, orgId: string, workOrderTitle: string, equipmentName?: string, equipmentId?: string, completedBy?: string): Promise<void> {
  try {
    const timestamp = new Date();
    const dayId = await ensureEngineLogDay(vesselId, orgId, timestamp);
    const idempotencyKey = createIdempotencyKey(ENGINE_LOG_EVENT_SOURCES.WORK_ORDER, ENGINE_LOG_EVENT_TYPES.WORK_ORDER_ACTION, vesselId, timestamp, workOrderId);

    await engineLogStorage.createEngineLogEvent({
      orgId, vesselId, dayId, timestamp,
      eventType: ENGINE_LOG_EVENT_TYPES.WORK_ORDER_ACTION,
      source: ENGINE_LOG_EVENT_SOURCES.WORK_ORDER,
      summary: `Work Order Completed: ${workOrderTitle}`,
      details: JSON.stringify({ workOrderId, equipment: equipmentName, completedBy }),
      workOrderId, equipmentId, idempotencyKey,
    });
  } catch (error) {
    console.error('[EngineLogEventService] Failed to create work order event:', error);
  }
}

export async function createFuelEvent(vesselId: string, orgId: string, eventType: 'FUEL_TRANSFER' | 'BUNKERING' | 'OIL_TRANSFER', summary: string, details: FuelEventDetails, createdByUserId?: string, createdByUserName?: string): Promise<void> {
  try {
    const timestamp = new Date();
    const dayId = await ensureEngineLogDay(vesselId, orgId, timestamp);
    const idempotencyKey = createIdempotencyKey(ENGINE_LOG_EVENT_SOURCES.FUEL_SYSTEM, eventType, vesselId, timestamp, `${details.fuelType}_${details.quantity}`);

    await engineLogStorage.createEngineLogEvent({
      orgId, vesselId, dayId, timestamp, eventType,
      source: ENGINE_LOG_EVENT_SOURCES.FUEL_SYSTEM,
      summary, details: JSON.stringify(details),
      createdByUserId, createdByUserName, idempotencyKey,
    });
  } catch (error) {
    console.error('[EngineLogEventService] Failed to create fuel event:', error);
  }
}

export async function createManualEngineEvent(vesselId: string, orgId: string, eventType: string, summary: string, details?: string, createdByUserId?: string, createdByUserName?: string, equipmentId?: string): Promise<void> {
  try {
    const timestamp = new Date();
    const dayId = await ensureEngineLogDay(vesselId, orgId, timestamp);

    await engineLogStorage.createEngineLogEvent({
      orgId, vesselId, dayId, timestamp, eventType,
      source: ENGINE_LOG_EVENT_SOURCES.MANUAL,
      summary, details, equipmentId, createdByUserId, createdByUserName,
    });
  } catch (error) {
    console.error('[EngineLogEventService] Failed to create manual event:', error);
  }
}

export async function createAlarmEvent(vesselId: string, orgId: string, alarmCode: string, description: string, severity: string, equipmentType?: string, equipmentId?: string, acknowledged?: boolean): Promise<void> {
  try {
    const timestamp = new Date();
    const dayId = await ensureEngineLogDay(vesselId, orgId, timestamp);
    const eventType = acknowledged ? ENGINE_LOG_EVENT_TYPES.ALARM_CLEARED : ENGINE_LOG_EVENT_TYPES.ALARM_TRIGGERED;
    const idempotencyKey = createIdempotencyKey(ENGINE_LOG_EVENT_SOURCES.ALARM_SYSTEM, eventType, vesselId, timestamp, alarmCode);

    await engineLogStorage.createEngineLogEvent({
      orgId, vesselId, dayId, timestamp, eventType,
      source: ENGINE_LOG_EVENT_SOURCES.ALARM_SYSTEM,
      summary: `${acknowledged ? 'Alarm Cleared' : 'Alarm Triggered'}: ${description}`,
      details: JSON.stringify({ alarmCode, description, severity, acknowledged }),
      alarmCode, alarmSeverity: severity,
      alarmAckAt: acknowledged ? timestamp : undefined,
      equipmentType, equipmentId, idempotencyKey,
    });
  } catch (error) {
    console.error('[EngineLogEventService] Failed to create alarm event:', error);
  }
}
