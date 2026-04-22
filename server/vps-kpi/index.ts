/**
 * VPS KPI Service Module - Public API
 */

export * from "./types";
export {
  quantile,
  movingAverage,
  torqueToNm,
  computeVPSKPIs,
  calculatePowerSTWCurve,
} from "./calculations";
export {
  computeEquipmentLoadDistribution,
  computeFleetLoadBenchmarks,
  computeFleetPowerSTWBenchmarks,
} from "./fleet-benchmarks";
