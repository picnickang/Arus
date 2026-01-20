/**
 * Marine Sensor Definitions
 */

import type { SensorDefinition } from "./types";

export const MARINE_SENSORS: SensorDefinition[] = [
  // TEMPERATURE SENSORS
  { canonicalName: "coolant_temperature", category: "temperature", unit: "°C", aliases: ["coolant_temp", "engine_coolant", "water_temp", "coolant", "ect"], j1939Spn: 110, description: "Engine coolant temperature", validRange: { min: -40, max: 150 }, criticalThreshold: { max: 100 } },
  { canonicalName: "oil_temperature", category: "temperature", unit: "°C", aliases: ["oil_temp", "lube_temp", "engine_oil_temp", "eot"], j1939Spn: 175, description: "Engine oil temperature", validRange: { min: -40, max: 150 }, criticalThreshold: { max: 120 } },
  { canonicalName: "exhaust_temperature", category: "temperature", unit: "°C", aliases: ["exhaust_temp", "egt", "turbo_temp", "manifold_temp"], j1939Spn: 173, description: "Exhaust gas temperature", validRange: { min: 0, max: 800 }, criticalThreshold: { max: 550 } },
  { canonicalName: "intake_air_temperature", category: "temperature", unit: "°C", aliases: ["intake_temp", "iat", "charge_air_temp", "manifold_air_temp"], j1939Spn: 172, description: "Intake air temperature", validRange: { min: -40, max: 100 } },
  { canonicalName: "fuel_temperature", category: "fuel", unit: "°C", aliases: ["fuel_temp", "diesel_temp"], j1939Spn: 174, description: "Fuel temperature", validRange: { min: -40, max: 100 } },
  // PRESSURE SENSORS
  { canonicalName: "oil_pressure", category: "pressure", unit: "kPa", aliases: ["lube_pressure", "engine_oil_pressure", "oil_press", "eop"], j1939Spn: 100, description: "Engine oil pressure", validRange: { min: 0, max: 1000 }, criticalThreshold: { min: 150 } },
  { canonicalName: "fuel_pressure", category: "fuel", unit: "kPa", aliases: ["fuel_press", "rail_pressure", "injection_pressure"], j1939Spn: 94, description: "Fuel delivery pressure", validRange: { min: 0, max: 2000 }, criticalThreshold: { min: 200 } },
  { canonicalName: "boost_pressure", category: "pressure", unit: "kPa", aliases: ["turbo_pressure", "intake_manifold_pressure", "map", "boost"], j1939Spn: 102, description: "Turbocharger boost pressure", validRange: { min: 0, max: 500 } },
  { canonicalName: "hydraulic_pressure", category: "pressure", unit: "kPa", aliases: ["hydraulic_press", "hyd_pressure", "system_pressure"], description: "Hydraulic system pressure", validRange: { min: 0, max: 30000 }, criticalThreshold: { min: 5000 } },
  // VIBRATION SENSORS
  { canonicalName: "vibration_rms", category: "vibration", unit: "mm/s", aliases: ["vib_rms", "vibration", "rms_velocity", "vib"], description: "RMS vibration velocity", validRange: { min: 0, max: 50 }, criticalThreshold: { max: 15 } },
  { canonicalName: "vibration_peak", category: "vibration", unit: "mm/s", aliases: ["vib_peak", "peak_velocity", "max_vibration"], description: "Peak vibration velocity", validRange: { min: 0, max: 100 }, criticalThreshold: { max: 30 } },
  { canonicalName: "acceleration", category: "vibration", unit: "g", aliases: ["accel", "g_force", "vibration_accel"], description: "Vibration acceleration", validRange: { min: 0, max: 10 } },
  // SPEED / RPM SENSORS
  { canonicalName: "engine_speed", category: "speed", unit: "rpm", aliases: ["rpm", "engine_rpm", "shaft_speed", "crankshaft_rpm"], j1939Spn: 190, description: "Engine rotational speed", validRange: { min: 0, max: 3000 }, criticalThreshold: { max: 2400 } },
  { canonicalName: "propeller_speed", category: "speed", unit: "rpm", aliases: ["prop_rpm", "shaft_rpm", "propeller_rpm"], description: "Propeller shaft speed", validRange: { min: 0, max: 1200 } },
  { canonicalName: "generator_frequency", category: "electrical", unit: "Hz", aliases: ["gen_freq", "ac_frequency", "frequency"], j1939Spn: 1806, description: "AC generator frequency", validRange: { min: 55, max: 65 }, criticalThreshold: { min: 59, max: 61 } },
  // FLOW SENSORS
  { canonicalName: "fuel_rate", category: "fuel", unit: "L/h", aliases: ["fuel_consumption", "fuel_flow", "consumption_rate", "lph"], j1939Spn: 183, description: "Fuel consumption rate", validRange: { min: 0, max: 1000 } },
  { canonicalName: "coolant_flow", category: "flow", unit: "L/min", aliases: ["water_flow", "cooling_flow"], description: "Coolant flow rate", validRange: { min: 0, max: 500 } },
  // ELECTRICAL SENSORS
  { canonicalName: "battery_voltage", category: "electrical", unit: "V", aliases: ["voltage", "bus_voltage", "batt_voltage"], j1939Spn: 168, description: "Battery/bus voltage", validRange: { min: 18, max: 32 }, criticalThreshold: { min: 22, max: 28 } },
  { canonicalName: "alternator_current", category: "electrical", unit: "A", aliases: ["current", "charging_current", "alt_current"], description: "Alternator output current", validRange: { min: -50, max: 200 } },
  // FUEL SYSTEM
  { canonicalName: "fuel_level", category: "fuel", unit: "%", aliases: ["tank_level", "fuel_tank", "fuel_percentage"], j1939Spn: 96, description: "Fuel tank level", validRange: { min: 0, max: 100 }, criticalThreshold: { min: 10 } },
  // POSITION / NAVIGATION
  { canonicalName: "rudder_angle", category: "position", unit: "deg", aliases: ["rudder_position", "steering_angle"], description: "Rudder angle", validRange: { min: -45, max: 45 } },
  { canonicalName: "trim_angle", category: "position", unit: "deg", aliases: ["trim_position", "trim"], description: "Drive trim angle", validRange: { min: -10, max: 10 } },
];
