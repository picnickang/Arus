/**
 * Engine Log Event - Telemetry Processor
 */

import type { TelemetryInput } from './types.js';
import { ENGINE_LOG_EVENT_TYPES, ME_RPM_THRESHOLD, DG_LOAD_THRESHOLD, TEMP_HIGH_THRESHOLD, PRESS_LOW_THRESHOLD } from './types.js';
import { getVesselEngineState, setVesselEngineState, initVesselEngineState } from './state-manager.js';
import { createEngineEvent } from './helpers.js';

export async function processTelemetryForEngineLog(vesselId: string, orgId: string, telemetryData: TelemetryInput): Promise<void> {
  try {
    let state = getVesselEngineState(vesselId);
    if (!state) { state = initVesselEngineState(vesselId, orgId); }

    const meRunning = (telemetryData.meRpm ?? 0) > ME_RPM_THRESHOLD;

    if (meRunning && !state.meRunning) {
      await createEngineEvent(vesselId, orgId, telemetryData.timestamp, {
        eventType: ENGINE_LOG_EVENT_TYPES.ME_START,
        summary: 'Main Engine started',
        details: JSON.stringify({ rpm: telemetryData.meRpm, load: telemetryData.meLoad }),
        equipmentId: telemetryData.equipmentId,
        meRpm: telemetryData.meRpm,
        meLoad: telemetryData.meLoad,
      });
    }

    if (!meRunning && state.meRunning) {
      await createEngineEvent(vesselId, orgId, telemetryData.timestamp, {
        eventType: ENGINE_LOG_EVENT_TYPES.ME_STOP,
        summary: 'Main Engine stopped',
        details: JSON.stringify({ lastRpm: state.meRpm, reason: 'RPM below threshold' }),
        equipmentId: telemetryData.equipmentId,
        meRpm: telemetryData.meRpm,
      });
    }

    if (telemetryData.meExhaustTemp && telemetryData.meExhaustTemp > TEMP_HIGH_THRESHOLD) {
      if (!state.meExhaustTemp || state.meExhaustTemp <= TEMP_HIGH_THRESHOLD) {
        await createEngineEvent(vesselId, orgId, telemetryData.timestamp, {
          eventType: ENGINE_LOG_EVENT_TYPES.TEMPERATURE_ALERT,
          summary: `ME Exhaust temperature high: ${telemetryData.meExhaustTemp}°C`,
          details: JSON.stringify({ temp: telemetryData.meExhaustTemp, threshold: TEMP_HIGH_THRESHOLD }),
          equipmentId: telemetryData.equipmentId,
          meExhaustTemp: telemetryData.meExhaustTemp,
        }, 'exhaust_high');
      }
    }

    if (telemetryData.meLubOilPress !== undefined && telemetryData.meLubOilPress < PRESS_LOW_THRESHOLD) {
      if (state.meLubOilPress === undefined || state.meLubOilPress >= PRESS_LOW_THRESHOLD) {
        await createEngineEvent(vesselId, orgId, telemetryData.timestamp, {
          eventType: ENGINE_LOG_EVENT_TYPES.PRESSURE_ALERT,
          summary: `ME Lub Oil pressure low: ${telemetryData.meLubOilPress} bar`,
          details: JSON.stringify({ pressure: telemetryData.meLubOilPress, threshold: PRESS_LOW_THRESHOLD }),
          equipmentId: telemetryData.equipmentId,
          meLubOilPress: telemetryData.meLubOilPress,
        }, 'luboil_low');
      }
    }

    if (telemetryData.generators) {
      for (const gen of telemetryData.generators) {
        const prevGenState = state.generators[gen.number];
        const genRunning = gen.loadKw > DG_LOAD_THRESHOLD;

        if (genRunning && (!prevGenState || !prevGenState.running)) {
          await createEngineEvent(vesselId, orgId, telemetryData.timestamp, {
            eventType: ENGINE_LOG_EVENT_TYPES.DG_START,
            summary: `Generator ${gen.number} started`,
            details: JSON.stringify({ generator: gen.number, loadKw: gen.loadKw, voltage: gen.voltage }),
            dgNumber: gen.number,
            dgLoadKw: gen.loadKw,
            dgVoltage: gen.voltage,
            dgFrequency: gen.frequency,
          }, `gen_${gen.number}`);
        }

        if (!genRunning && prevGenState?.running) {
          await createEngineEvent(vesselId, orgId, telemetryData.timestamp, {
            eventType: ENGINE_LOG_EVENT_TYPES.DG_STOP,
            summary: `Generator ${gen.number} stopped`,
            details: JSON.stringify({ generator: gen.number, lastLoadKw: prevGenState.loadKw }),
            dgNumber: gen.number,
          }, `gen_${gen.number}`);
        }

        state.generators[gen.number] = { running: genRunning, loadKw: gen.loadKw, voltage: gen.voltage ?? 0, frequency: gen.frequency ?? 0 };
      }
    }

    if (telemetryData.alarms && telemetryData.alarms.length > 0) {
      for (const alarm of telemetryData.alarms) {
        await createEngineEvent(vesselId, orgId, telemetryData.timestamp, {
          eventType: ENGINE_LOG_EVENT_TYPES.ALARM_TRIGGERED,
          summary: `Engine Room Alarm: ${alarm.description}`,
          details: JSON.stringify(alarm),
          alarmCode: alarm.code,
          alarmSeverity: alarm.severity,
          equipmentType: alarm.equipment,
        }, `alarm_${alarm.code}`);
      }
    }

    state.meRunning = meRunning;
    state.meRpm = telemetryData.meRpm ?? 0;
    state.meLoad = telemetryData.meLoad ?? 0;
    state.meExhaustTemp = telemetryData.meExhaustTemp ?? 0;
    state.meLubOilPress = telemetryData.meLubOilPress ?? 0;
    state.lastTimestamp = telemetryData.timestamp;
    setVesselEngineState(vesselId, state);
  } catch (error) {
    console.error('[EngineLogEventService] Failed to process telemetry for engine log:', error);
  }
}
