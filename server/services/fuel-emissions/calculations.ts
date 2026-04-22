/**
 * Fuel Emissions Calculations - SFOC, consumption, emissions, CII
 */

import { EMISSION_FACTORS, SFOC_CURVE, type FuelType } from "./constants";

export function getSFOC(loadPercent: number): number {
  const loads = Object.keys(SFOC_CURVE)
    .map(Number)
    .sort((a, b) => a - b);

  let lowerLoad = loads[0];
  let upperLoad = loads[loads.length - 1];

  for (let i = 0; i < loads.length - 1; i++) {
    if (loadPercent >= loads[i] && loadPercent <= loads[i + 1]) {
      lowerLoad = loads[i];
      upperLoad = loads[i + 1];
      break;
    }
  }

  const lowerSFOC = SFOC_CURVE[lowerLoad as keyof typeof SFOC_CURVE];
  const upperSFOC = SFOC_CURVE[upperLoad as keyof typeof SFOC_CURVE];

  if (lowerLoad === upperLoad) {
    return lowerSFOC;
  }

  const ratio = (loadPercent - lowerLoad) / (upperLoad - lowerLoad);
  return lowerSFOC + ratio * (upperSFOC - lowerSFOC);
}

export function calculateFuelConsumption(powerKwh: number, sfocGPerKwh: number): number {
  return (powerKwh * sfocGPerKwh) / 1_000_000;
}

export function calculateEmissions(
  fuelMt: number,
  fuelType: FuelType = "VLSFO"
): { co2Mt: number; soxKg: number; noxKg: number } {
  const factors = EMISSION_FACTORS[fuelType];
  return {
    co2Mt: fuelMt * factors.co2,
    soxKg: fuelMt * factors.sox * 1000,
    noxKg: fuelMt * factors.nox * 1000,
  };
}

export function getCIIRating(cii: number, vesselType: string = "bulk_carrier"): string {
  const boundaries = { A: 0.75, B: 0.85, C: 0.95, D: 1.05, E: 1.15 };

  if (cii <= boundaries.A) {
    return "A";
  }
  if (cii <= boundaries.B) {
    return "B";
  }
  if (cii <= boundaries.C) {
    return "C";
  }
  if (cii <= boundaries.D) {
    return "D";
  }
  return "E";
}

export function calculateDataQuality(completeness: number): "high" | "medium" | "low" {
  if (completeness >= 0.9) {
    return "high";
  }
  if (completeness >= 0.5) {
    return "medium";
  }
  return "low";
}

export function calculateEEOI(
  totalFuelMt: number,
  cargoTons: number,
  distanceNm: number
): number | null {
  if (distanceNm > 0 && cargoTons > 0) {
    return (totalFuelMt * 3.114) / (cargoTons * distanceNm);
  }
  return null;
}

export function calculateCII(
  totalCo2Mt: number,
  vesselDwt: number,
  distanceNm: number
): number | null {
  if (distanceNm > 0 && vesselDwt > 0) {
    return (totalCo2Mt * 1000000) / (vesselDwt * distanceNm);
  }
  return null;
}
