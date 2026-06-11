const SENSOR_KIND_PRESETS = {
  vibration: {
    label: "Vibration",
    defaultUnit: "mm/s",
    description: "Overall vibration RMS for rotating equipment bearings and housings",
    defaultFields: {
      warn_rms: 7,
      crit_rms: 10,
      band_low_hz: 10,
      band_high_hz: 1e3,
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
    defaultUnit: "\xB0C",
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
    defaultUnit: "m\xB3/h",
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
      warn_high: 0.9,
      // Normalized to rated current
      crit_high: 1,
      imbalance_pct: 10,
      // Phase imbalance warning threshold
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
      crit_high: 2e3,
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
      particle_count_warn: 1e5,
      particle_count_crit: 25e4,
      sample_interval_min: 10,
      // Slow sampling for oil analysis
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
      band_low_hz: 1e3,
      band_high_hz: 1e4,
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
function getAllSensorKinds() {
  return Object.keys(SENSOR_KIND_PRESETS);
}
function isValidSensorKind(kind) {
  return kind in SENSOR_KIND_PRESETS;
}
function getPresetForKind(kind) {
  const normalizedKind = kind.toLowerCase();
  return isValidSensorKind(normalizedKind) ? SENSOR_KIND_PRESETS[normalizedKind] : void 0;
}
function getDefaultUnit(kind) {
  return SENSOR_KIND_PRESETS[kind].defaultUnit;
}
function getDefaultFields(kind) {
  return { ...SENSOR_KIND_PRESETS[kind].defaultFields };
}
export {
  SENSOR_KIND_PRESETS,
  getAllSensorKinds,
  getDefaultFields,
  getDefaultUnit,
  getPresetForKind,
  isValidSensorKind,
};
