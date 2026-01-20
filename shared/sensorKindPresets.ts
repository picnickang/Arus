/**
 * Sensor Kind Presets
 *
 * Standardized default configurations for all 12 supported sensor kinds.
 * These presets provide sensible starting points for marine PdM applications,
 * with industry-standard thresholds, units, and sampling rates.
 *
 * Usage:
 * - Frontend: Auto-fill forms when creating sensor templates
 * - Backend: Validation and default value provision
 * - Seeders: Generate comprehensive equipment-specific templates
 */

export type SensorKind =
  | "vibration"
  | "pressure"
  | "temperature"
  | "flow"
  | "level"
  | "voltage"
  | "current"
  | "frequency"
  | "rpm"
  | "oil_debris"
  | "acoustic"
  | "position";

export interface SensorKindPreset {
  label: string;
  defaultUnit: string;
  defaultFields: Record<string, any>;
  description?: string;
}

/**
 * Complete sensor kind presets with marine-industry defaults
 */
export const SENSOR_KIND_PRESETS: Record<SensorKind, SensorKindPreset> = {
  vibration: {
    label: "Vibration",
    defaultUnit: "mm/s",
    description: "Overall vibration RMS for rotating equipment bearings and housings",
    defaultFields: {
      warn_rms: 7,
      crit_rms: 10,
      band_low_hz: 10,
      band_high_hz: 1000,
      sample_rate_hz: 100,
      ema_alpha: 0.1,
    },
  },

  pressure: {
    label: "Pressure",
    defaultUnit: "bar",
    description: "Hydraulic or pneumatic pressure monitoring",
    defaultFields: {
      warn_low: 2,
      warn_high: 8,
      crit_low: 1,
      crit_high: 10,
      sample_rate_sec: 10,
      hysteresis: 0.2,
    },
  },

  temperature: {
    label: "Temperature",
    defaultUnit: "°C",
    description: "Thermal monitoring for bearings, oil, coolant, exhaust",
    defaultFields: {
      warn_high: 85,
      crit_high: 95,
      sample_rate_sec: 30,
      thermal_inertia_sec: 120,
      hysteresis: 2,
    },
  },

  flow: {
    label: "Flow",
    defaultUnit: "m³/h",
    description: "Fluid flow rate monitoring for pumps and transfer systems",
    defaultFields: {
      warn_low: 50,
      warn_high: 200,
      crit_low: 25,
      crit_high: 250,
      sample_rate_sec: 30,
      hysteresis: 5,
    },
  },

  level: {
    label: "Level",
    defaultUnit: "%",
    description: "Tank or reservoir level monitoring",
    defaultFields: {
      warn_low: 20,
      crit_low: 10,
      warn_high: 80,
      crit_high: 90,
      sample_rate_sec: 60,
      hysteresis: 2,
    },
  },

  voltage: {
    label: "Voltage",
    defaultUnit: "V",
    description: "Electrical voltage monitoring for generators and distribution",
    defaultFields: {
      warn_low: 380,
      crit_low: 360,
      warn_high: 430,
      crit_high: 440,
      sample_rate_sec: 10,
      hysteresis: 5,
    },
  },

  current: {
    label: "Current",
    defaultUnit: "A",
    description: "Electrical current monitoring for motors and generators",
    defaultFields: {
      warn_high: 0.9, // Normalized to rated current
      crit_high: 1,
      imbalance_pct: 10, // Phase imbalance warning threshold
      sample_rate_sec: 10,
      hysteresis: 0.05,
    },
  },

  frequency: {
    label: "Frequency",
    defaultUnit: "Hz",
    description: "AC electrical frequency monitoring",
    defaultFields: {
      target: 60,
      tolerance: 0.5,
      warn_deviation: 1,
      crit_deviation: 2,
      sample_rate_sec: 5,
    },
  },

  rpm: {
    label: "RPM",
    defaultUnit: "rpm",
    description: "Rotational speed monitoring for engines, shafts, and rotating equipment",
    defaultFields: {
      target: 1800,
      warn_low: 1700,
      warn_high: 1900,
      crit_low: 1600,
      crit_high: 2000,
      sample_rate_sec: 5,
      hysteresis: 50,
    },
  },

  oil_debris: {
    label: "Oil Debris",
    defaultUnit: "ppm",
    description: "Wear particle monitoring for oil condition analysis",
    defaultFields: {
      warn_wear_ppm: 75,
      crit_wear_ppm: 150,
      particle_count_warn: 100000,
      particle_count_crit: 250000,
      sample_interval_min: 10, // Slow sampling for oil analysis
      iso_4406_warn: 19,
      iso_4406_crit: 21,
    },
  },

  acoustic: {
    label: "Acoustic",
    defaultUnit: "dB",
    description: "Sound level monitoring for bearing noise and ultrasonic detection",
    defaultFields: {
      warn_level: 75,
      crit_level: 85,
      band_low_hz: 1000,
      band_high_hz: 10000,
      sample_rate_hz: 100,
      ema_alpha: 0.1,
    },
  },

  position: {
    label: "Position",
    defaultUnit: "deg",
    description: "Angular position monitoring for rudders, valves, and actuators",
    defaultFields: {
      warn_deviation: 2,
      crit_deviation: 5,
      sample_rate_sec: 5,
      hysteresis: 0.5,
    },
  },
};

/**
 * Get all available sensor kinds
 */
export function getAllSensorKinds(): SensorKind[] {
  return Object.keys(SENSOR_KIND_PRESETS) as SensorKind[];
}

/**
 * Check if a string is a valid sensor kind
 */
export function isValidSensorKind(kind: string): kind is SensorKind {
  return kind in SENSOR_KIND_PRESETS;
}

/**
 * Get preset for a specific sensor kind (case-insensitive)
 */
export function getPresetForKind(kind: string): SensorKindPreset | undefined {
  const normalizedKind = kind.toLowerCase();
  return isValidSensorKind(normalizedKind) ? SENSOR_KIND_PRESETS[normalizedKind] : undefined;
}

/**
 * Get default unit for a sensor kind
 */
export function getDefaultUnit(kind: SensorKind): string {
  return SENSOR_KIND_PRESETS[kind].defaultUnit;
}

/**
 * Get default fields for a sensor kind
 */
export function getDefaultFields(kind: SensorKind): Record<string, any> {
  return { ...SENSOR_KIND_PRESETS[kind].defaultFields }; // Return copy to prevent mutation
}
