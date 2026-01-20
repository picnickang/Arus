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
  rawJson?: any;
}

export interface FMCCServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  source: "fmcc" | "cache" | "mock";
  responseTimeMs: number;
}
