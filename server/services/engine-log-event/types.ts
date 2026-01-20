/**
 * Engine Log Event - Type Definitions and Constants
 */

export const ENGINE_LOG_EVENT_TYPES = {
  ME_START: 'ME_START',
  ME_STOP: 'ME_STOP',
  ME_LOAD_CHANGE: 'ME_LOAD_CHANGE',
  DG_START: 'DG_START',
  DG_STOP: 'DG_STOP',
  DG_LOAD_TRANSFER: 'DG_LOAD_TRANSFER',
  FUEL_TRANSFER: 'FUEL_TRANSFER',
  BUNKERING: 'BUNKERING',
  OIL_TRANSFER: 'OIL_TRANSFER',
  BILGE_PUMP: 'BILGE_PUMP',
  ALARM_TRIGGERED: 'ALARM_TRIGGERED',
  ALARM_CLEARED: 'ALARM_CLEARED',
  WORK_ORDER_ACTION: 'WORK_ORDER_ACTION',
  WATCH_CHANGE: 'WATCH_CHANGE',
  MAINTENANCE: 'MAINTENANCE',
  INSPECTION: 'INSPECTION',
  TEMPERATURE_ALERT: 'TEMPERATURE_ALERT',
  PRESSURE_ALERT: 'PRESSURE_ALERT',
  MANUAL_ENTRY: 'MANUAL_ENTRY',
  REMARK: 'REMARK',
  CUSTOM: 'CUSTOM',
} as const;

export const ENGINE_LOG_EVENT_SOURCES = {
  TELEMETRY: 'telemetry',
  WORK_ORDER: 'work_order',
  CREW_SCHEDULER: 'crew_scheduler',
  MANUAL: 'manual',
  ALARM_SYSTEM: 'alarm_system',
  FUEL_SYSTEM: 'fuel_system',
} as const;

export interface EngineTelemetryState {
  vesselId: string;
  orgId: string;
  meRunning: boolean;
  meRpm: number;
  meLoad: number;
  meExhaustTemp: number;
  meLubOilPress: number;
  generators: {
    [genNum: number]: {
      running: boolean;
      loadKw: number;
      voltage: number;
      frequency: number;
    };
  };
  lastTimestamp?: Date;
}

export interface TelemetryInput {
  timestamp: Date;
  equipmentId?: string;
  meRpm?: number;
  meLoad?: number;
  meExhaustTemp?: number;
  meLubOilPress?: number;
  meFuelRack?: number;
  meScavAirPress?: number;
  meCoolantTempIn?: number;
  meCoolantTempOut?: number;
  generators?: Array<{
    number: number;
    running: boolean;
    loadKw: number;
    voltage?: number;
    frequency?: number;
    exhaustTemp?: number;
  }>;
  alarms?: Array<{ code: string; description: string; severity: string; equipment?: string }>;
}

export interface FuelEventDetails {
  fuelType?: string;
  quantity?: number;
  unit?: string;
  fromTank?: string;
  toTank?: string;
  supplier?: string;
  port?: string;
  bunkerNote?: string;
}

export const ME_RPM_THRESHOLD = 100;
export const DG_LOAD_THRESHOLD = 10;
export const TEMP_HIGH_THRESHOLD = 400;
export const PRESS_LOW_THRESHOLD = 2;
