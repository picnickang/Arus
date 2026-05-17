/**
 * Legacy digital-twin fuel calculation shim.
 */

export interface FuelCharacteristics {
  displacement?: number;
  hullEfficiency?: number;
  propellerEfficiency?: number;
  engineLoad?: number;
  [k: string]: unknown;
}

export function predictFuelConsumption(
  characteristics: FuelCharacteristics,
  speedKnots?: number
): number {
  const disp = Number(characteristics.displacement ?? 1000);
  const speed = Number(speedKnots ?? 10);
  const load = Number(characteristics.engineLoad ?? 0.5);
  return Math.max(0, 0.0001 * disp * Math.pow(speed, 2.5) * load);
}
