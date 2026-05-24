/**
 * Digital Twin Normalizer
 */

import type { DigitalTwin } from "@shared/schema";

type MaintenanceForecast = ReturnType<typeof generateMaintenanceForecast>;

export function normalizeDigitalTwin(
  twin: DigitalTwin
): DigitalTwin & { maintenanceForecast?: MaintenanceForecast } {
  const normalized = {
    ...twin,
    lastUpdate: twin.lastUpdate || new Date(),
    createdAt: twin.createdAt || new Date(),
    updatedAt: twin.updatedAt || new Date(),
    specifications: twin.specifications ?? {
      type: "unknown",
      capacity: null,
      manufacturer: null,
      model: null,
    },
    cadModel: twin.cadModel ?? { available: false, format: null, path: null },
    physicsModel: twin.physicsModel ?? { type: "empirical", parameters: {}, validated: false },
    currentState: twin.currentState ?? {
      operational: true,
      health: 100,
      lastSync: new Date().toISOString(),
    },
    simulationConfig: twin.simulationConfig ?? { enabled: false, updateFrequency: "hourly" },
    validationStatus: twin.validationStatus ?? "active",
    accuracy: twin.accuracy ?? 85,
    metadata: twin.metadata ?? {},
  };

  const maintenanceForecast = generateMaintenanceForecast(normalized);

  return { ...normalized, maintenanceForecast };
}

function generateMaintenanceForecast(twin: DigitalTwin) {
  const currentState = (twin.currentState ?? {}) as Record<string, unknown>;
  const healthRaw = currentState.health;
  const health = typeof healthRaw === "number" ? healthRaw : 100;

  const now = new Date();
  return {
    nextMaintenanceDate: new Date(
      now.getTime() + (health > 80 ? 90 : health > 60 ? 60 : 30) * 24 * 60 * 60 * 1000
    ),
    maintenanceType: health > 80 ? "routine" : health > 60 ? "preventive" : "corrective",
    priority: health > 80 ? "low" : health > 60 ? "medium" : "high",
    estimatedCost: {
      labor: health > 80 ? 500 : health > 60 ? 1500 : 5000,
      parts: health > 80 ? 200 : health > 60 ? 800 : 3000,
      downtime: health > 80 ? 2 : health > 60 ? 4 : 8,
      currency: "USD",
    },
    predictedIssues:
      health > 80
        ? ["Routine inspection required"]
        : health > 60
          ? ["Wear detected", "Performance degradation"]
          : ["Critical wear", "Failure risk", "Immediate attention required"],
    confidence: 0.75,
  };
}

export function normalizeDigitalTwins(
  twins: DigitalTwin[]
): (DigitalTwin & { maintenanceForecast?: MaintenanceForecast })[] {
  return twins.map(normalizeDigitalTwin);
}
