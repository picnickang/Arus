/**
 * VPS KPI Service Types
 */

export interface VPSPayload {
  timestamp?: (string | number)[];
  rpm?: number[];
  shaft_torque?: number[];
  fuel_rate?: number[];
  stw?: number[];
  torque_unit?: "Nm" | "kNm";
}

export interface VPSConfiguration {
  max_torque_nm?: number;
  fuel_density_kg_per_l?: number;
  torque_unit?: "Nm" | "kNm";
}

export interface LoadVsSFOC {
  x: number;
  y: number;
}

export interface FuelVsTime {
  x: string | number;
  y: number;
}

export interface PowerVsSTW {
  x: number;
  y: number;
}

export interface LoadHistBin {
  bin: number;
  hours: number;
}

export interface VPSKPIResult {
  meta: {
    max_torque_nm: number;
    fuel_density_kg_per_l: number;
    torque_unit: string;
  };
  series: {
    load_vs_sfoc: LoadVsSFOC[];
    fuel_vs_time: FuelVsTime[];
    power_vs_stw: PowerVsSTW[];
    load_hist: LoadHistBin[];
  };
}

export interface FleetLoadBenchmark {
  bin: number;
  fleetAvg: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface FleetPowerSTWBenchmark {
  speed: number;
  fleetAvgPower: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface FleetBenchmarkResult {
  loadDistribution: FleetLoadBenchmark[];
  powerSTW: FleetPowerSTWBenchmark[];
  vesselCount: number;
  periodStart: string;
  periodEnd: string;
}
