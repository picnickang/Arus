/**
 * Fuel Emissions Constants - IMO factors and SFOC curves
 */

export const EMISSION_FACTORS = {
  HFO: { co2: 3.114, sox: 0.02, nox: 0.087 },
  VLSFO: { co2: 3.151, sox: 0.005, nox: 0.082 },
  ULSFO: { co2: 3.206, sox: 0.001, nox: 0.08 },
  MGO: { co2: 3.206, sox: 0.001, nox: 0.078 },
  MDO: { co2: 3.206, sox: 0.002, nox: 0.08 },
  LNG: { co2: 2.75, sox: 0, nox: 0.02 },
};

export const SFOC_CURVE = {
  25: 210,
  50: 185,
  75: 175,
  85: 173,
  100: 178,
};

export type FuelType = keyof typeof EMISSION_FACTORS;
