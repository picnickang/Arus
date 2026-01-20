/**
 * Sensor Taxonomy Types
 */

export interface SensorDefinition {
  canonicalName: string;
  category: "temperature" | "pressure" | "vibration" | "flow" | "electrical" | "speed" | "position" | "fuel" | "other";
  unit: string;
  aliases: string[];
  j1939Spn?: number;
  nmeaPgn?: number;
  description: string;
  validRange?: { min: number; max: number };
  criticalThreshold?: { min?: number; max?: number };
}
