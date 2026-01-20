/**
 * Sensor Classification / Fuzzy Matching
 */

import type { SensorDefinition } from "./types";
import { MARINE_SENSORS } from "./sensors";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  temperature: ["temp", "temperature", "heat"],
  pressure: ["press", "pressure", "psi", "bar", "kpa"],
  vibration: ["vib", "vibration", "accel", "shake"],
  speed: ["rpm", "speed", "rotation"],
  electrical: ["volt", "amp", "current", "battery"],
  fuel: ["fuel", "diesel", "consumption"],
  flow: ["flow", "rate", "lph", "gph"],
};

export function classifySensor(rawName: string, unit?: string, spn?: number): { sensor: SensorDefinition; confidence: number } | null {
  const normalized = rawName.toLowerCase().trim();

  // 1. Exact SPN match (highest confidence)
  if (spn !== undefined) {
    const spnMatch = MARINE_SENSORS.find((s) => s.j1939Spn === spn);
    if (spnMatch) {return { sensor: spnMatch, confidence: 0.99 };}
  }

  // 2. Exact canonical name match
  const exactMatch = MARINE_SENSORS.find((s) => s.canonicalName === normalized);
  if (exactMatch) {return { sensor: exactMatch, confidence: 0.98 };}

  // 3. Exact alias match
  for (const sensor of MARINE_SENSORS) {
    if (sensor.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return { sensor, confidence: 0.95 };
    }
  }

  // 4. Fuzzy alias match (contains)
  for (const sensor of MARINE_SENSORS) {
    for (const alias of sensor.aliases) {
      const aliasLower = alias.toLowerCase();
      if (normalized.includes(aliasLower) || aliasLower.includes(normalized)) {
        return { sensor, confidence: 0.85 };
      }
    }
  }

  // 5. Category keyword match (lower confidence)
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        const categoryMatch = MARINE_SENSORS.find((s) => s.category === category);
        if (categoryMatch) {return { sensor: categoryMatch, confidence: 0.6 };}
      }
    }
  }

  return null;
}
