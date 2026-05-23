/**
 * Aquametro FMCC - Types and Interfaces
 *
 * @see https://www.aquametro-oil-marine.com/products/fmcc/
 */

export interface FMCCConfig {
  enabled: boolean;
  protocol: "rest" | "modbus";
  restConfig?: {
    baseUrl: string;
    apiKey?: string;
    username?: string;
    password?: string;
    timeoutMs: number;
  };
  modbusConfig?: {
    host: string;
    port: number;
    unitId: number;
    timeoutMs: number;
  };
  pollIntervalSeconds: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface FMCCInstantFlow {
  timestamp: Date;
  vesselId: string;
  foFlowKgPerH: number;
  doFlowKgPerH: number;
  foReturnFlowKgPerH: number;
  doReturnFlowKgPerH: number;
  foNetFlowKgPerH: number;
  doNetFlowKgPerH: number;
  foDensity: number;
  doDensity: number;
  foTemperature: number;
  doTemperature: number;
  meterStatus: "online" | "offline" | "error" | "maintenance";
  errorCode?: string;
}

export interface FMCCCumulativeCounters {
  vesselId: string;
  periodStart: Date;
  periodEnd: Date;
  foConsumedKg: number;
  doConsumedKg: number;
  foConsumedMt: number;
  doConsumedMt: number;
  totalFuelKg: number;
  totalFuelMt: number;
  avgFoDensity: number;
  avgDoDensity: number;
  avgFoTemperature: number;
  avgDoTemperature: number;
  dataPoints: number;
  dataCompleteness: number;
}

export interface FMCCEngineEfficiency {
  vesselId: string;
  periodStart: Date;
  periodEnd: Date;
  sfocGPerKwh: number;
  avgLoadPercent: number;
  avgRpm: number;
  runningHours: number;
  totalPowerKwh: number;
  calculationMethod: "measured" | "derived";
}

export interface FMCCMeterStatus {
  vesselId: string;
  timestamp: Date;
  foMeterOnline: boolean;
  doMeterOnline: boolean;
  foMeterLastReading: Date | null;
  doMeterLastReading: Date | null;
  alarms: FMCCAlarm[];
  firmwareVersion: string;
  calibrationDue: Date | null;
}

export interface FMCCAlarm {
  code: string;
  severity: "warning" | "error" | "critical";
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface FMCCRawSample {
  timestamp: Date;
  registers: Record<string, number>;
  rawJson?: unknown;
}

export interface FMCCServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  source: "fmcc" | "cache" | "mock";
  responseTimeMs: number;
}

/**
 * Raw (untyped) shapes returned by the FMCC REST API.
 * The API ships snake_case fields; some installations also use camelCase.
 * All fields are optional — mappers default-coalesce missing keys.
 */
export interface FMCCRawInstantFlow {
  timestamp?: string | number;
  fo_flow_rate?: number;
  foFlowKgPerH?: number;
  do_flow_rate?: number;
  doFlowKgPerH?: number;
  fo_return_flow?: number;
  foReturnFlowKgPerH?: number;
  do_return_flow?: number;
  doReturnFlowKgPerH?: number;
  fo_density?: number;
  foDensity?: number;
  do_density?: number;
  doDensity?: number;
  fo_temperature?: number;
  foTemperature?: number;
  do_temperature?: number;
  doTemperature?: number;
  status?: string;
  error_code?: string;
}

export interface FMCCRawCumulative {
  fo_consumed_kg?: number;
  foConsumedKg?: number;
  do_consumed_kg?: number;
  doConsumedKg?: number;
  avg_fo_density?: number;
  avgFoDensity?: number;
  avg_do_density?: number;
  avgDoDensity?: number;
  avg_fo_temperature?: number;
  avgFoTemperature?: number;
  avg_do_temperature?: number;
  avgDoTemperature?: number;
  data_points?: number;
  dataPoints?: number;
  data_completeness?: number;
  dataCompleteness?: number;
}

export interface FMCCRawAlarm {
  code: string;
  severity?: FMCCAlarm["severity"];
  message: string;
  timestamp: string | number;
  acknowledged?: boolean;
}

export interface FMCCRawMeterStatus {
  timestamp?: string | number;
  fo_meter_online?: boolean;
  foMeterOnline?: boolean;
  do_meter_online?: boolean;
  doMeterOnline?: boolean;
  fo_last_reading?: string | number;
  do_last_reading?: string | number;
  alarms?: FMCCRawAlarm[];
  firmware_version?: string;
  firmwareVersion?: string;
  calibration_due?: string | number;
}
