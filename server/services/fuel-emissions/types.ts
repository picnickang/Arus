/**
 * Fuel Emissions Types - Interfaces and type definitions
 */

export interface FuelEmissionsResult {
  success: boolean;
  recordsCreated: number;
  recordsUpdated: number;
  errors: string[];
  dataSource?: 'fmcc' | 'telemetry' | 'mixed';
  fmccRecords?: number;
  telemetryRecords?: number;
}

export interface TelemetryPeriod {
  periodStart: Date;
  periodEnd: Date;
  avgEngineLoad: number;
  avgGeneratorLoad: number;
  meRunningHours: number;
  dgRunningHours: number;
  totalPowerKwh: number;
  distanceNm: number;
  avgSpeedKn: number;
  dataPoints: number;
}

export interface FuelEmissionsSummary {
  totalFuelMt: number;
  totalCo2Mt: number;
  avgCii: number;
  ciiRating: string;
  distanceNm: number;
  runningHours: number;
}
