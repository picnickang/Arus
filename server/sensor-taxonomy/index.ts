/**
 * Sensor Taxonomy Module - Public API
 */

export * from "./types";
export { MARINE_SENSORS } from "./sensors";
export { classifySensor } from "./classifier";
export { normalizeSensorValue, validateSensorReading } from "./converters";
export { getSensorsByCategory, getSensorByName, getSensorBySpn, getSensorDescription } from "./utils";
