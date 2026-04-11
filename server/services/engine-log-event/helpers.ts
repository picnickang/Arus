/**
 * Engine Log Event - Helper Functions
 */

import { engineLogStorage } from '../../repositories';
import type { InsertEngineLogEvent } from '@shared/schema';
import { ENGINE_LOG_EVENT_SOURCES } from './types.js';

export async function ensureEngineLogDay(vesselId: string, orgId: string, timestamp: Date): Promise<string> {
  const logDate = timestamp.toISOString().split('T')[0];
  let day = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);
  if (!day) {
    day = await engineLogStorage.createEngineLogDaily({ orgId, vesselId, logDate, status: 'open' });
  }
  return day.id;
}

export function createIdempotencyKey(source: string, eventType: string, vesselId: string, timestamp: Date, additionalContext?: string): string {
  const timeKey = timestamp.toISOString();
  const parts = [source, eventType, vesselId, timeKey];
  if (additionalContext) { parts.push(additionalContext); }
  return parts.join(':');
}

export async function createEngineEvent(vesselId: string, orgId: string, timestamp: Date, eventData: Partial<InsertEngineLogEvent>, additionalIdempotencyContext?: string): Promise<void> {
  try {
    const dayId = await ensureEngineLogDay(vesselId, orgId, timestamp);
    const idempotencyKey = createIdempotencyKey(ENGINE_LOG_EVENT_SOURCES.TELEMETRY, eventData.eventType!, vesselId, timestamp, additionalIdempotencyContext);

    await engineLogStorage.createEngineLogEvent({
      orgId, vesselId, dayId, timestamp,
      eventType: eventData.eventType!,
      source: ENGINE_LOG_EVENT_SOURCES.TELEMETRY,
      summary: eventData.summary!,
      details: eventData.details,
      equipmentType: eventData.equipmentType,
      equipmentId: eventData.equipmentId,
      meRpm: eventData.meRpm,
      meLoad: eventData.meLoad,
      meLubOilPress: eventData.meLubOilPress,
      meExhaustTemp: eventData.meExhaustTemp,
      dgNumber: eventData.dgNumber,
      dgLoadKw: eventData.dgLoadKw,
      dgVoltage: eventData.dgVoltage,
      dgFrequency: eventData.dgFrequency,
      alarmCode: eventData.alarmCode,
      alarmSeverity: eventData.alarmSeverity,
      idempotencyKey,
    });
  } catch (error) {
    console.error('[EngineLogEventService] Failed to create engine event:', error);
  }
}
