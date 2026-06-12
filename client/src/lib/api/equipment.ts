import { apiRequest } from "../queryClient";
import type { TelemetryTrend } from "@shared/schema";

export interface EquipmentHealth {
  equipmentId: string;
  healthScore: number;
  status: string;
  [key: string]: unknown;
}
import {
  equipmentHealthResponseSchema,
  type EquipmentHealthResponse,
} from "@shared/analytics-types";

export async function fetchEquipmentHealth(vesselId?: string): Promise<EquipmentHealth[]> {
  const params = new URLSearchParams();
  if (vesselId) {
    params.append("vesselId", vesselId);
  }
  const url = `/api/equipment/health${params.toString() ? `?${params.toString()}` : ""}`;
  return apiRequest("GET", url);
}

export async function fetchTelemetryTrends(
  vesselId?: string,
  equipmentId?: string,
  hours?: number
): Promise<TelemetryTrend[]> {
  const params = new URLSearchParams();
  if (vesselId) {
    params.set("vesselId", vesselId);
  }
  if (equipmentId) {
    params.set("equipmentId", equipmentId);
  }
  if (hours) {
    params.set("hours", hours.toString());
  }
  const url = `/api/telemetry/trends${params.toString() ? `?${params.toString()}` : ""}`;
  return await apiRequest("GET", url);
}

function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function mapHealthToCondition(
  healthIndex: number | null | undefined
): "excellent" | "good" | "fair" | "poor" | "critical" {
  if (healthIndex == null) {
    return "fair";
  }
  if (healthIndex >= 90) {
    return "excellent";
  }
  if (healthIndex >= 75) {
    return "good";
  }
  if (healthIndex >= 50) {
    return "fair";
  }
  if (healthIndex >= 25) {
    return "poor";
  }
  return "critical";
}

function mapHealthToRiskLevel(
  healthIndex: number | null | undefined
): "low" | "medium" | "high" | "critical" {
  if (healthIndex == null) {
    return "medium";
  }
  if (healthIndex >= 75) {
    return "low";
  }
  if (healthIndex >= 50) {
    return "medium";
  }
  if (healthIndex >= 25) {
    return "high";
  }
  return "critical";
}

export async function fetchEquipmentHealthTyped(
  vesselId?: string
): Promise<EquipmentHealthResponse> {
  const params = new URLSearchParams();
  if (vesselId) {
    params.append("vesselId", vesselId);
  }
  const url = `/api/equipment/health${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await apiRequest("GET", url);

  let normalizedResponse: EquipmentHealthResponse;
  if (Array.isArray(response)) {
    normalizedResponse = {
      results: response.map((item: Record<string, unknown>) => ({
        id: item["id"] as string,
        name: item["name"] as string,
        type: item["type"] as string,
        vesselId: isValidUuid(item["vesselId"])
          ? item["vesselId"]
          : isValidUuid(item["vessel"])
            ? item["vessel"]
            : null,
        vesselName: item["vesselName"] as string | undefined,
        condition: mapHealthToCondition(item["healthIndex"] as number | null),
        healthScore: (item["healthIndex"] as number) ?? 0,
        riskLevel: mapHealthToRiskLevel(item["healthIndex"] as number | null),
        lastMaintenanceDate: null,
        nextMaintenanceDate: null,
        alertCount: 0,
        operatingHours: 0,
        telemetryStatus: "active" as const,
      })),
      metadata: {
        orgId: "default-org-id",
        timestamp: new Date(),
        version: "1.0",
        total: response.length,
        page: 1,
        pageSize: response.length || 100,
        hasMore: false,
      },
    };
  } else if (response && typeof response === "object" && "results" in response) {
    normalizedResponse = response as EquipmentHealthResponse;
  } else {
    console.error("[API] Unexpected equipment health response format:", response);
    throw new Error("Invalid equipment health response format");
  }

  const result = equipmentHealthResponseSchema.safeParse(normalizedResponse);
  if (!result.success) {
    console.warn(
      "[API] Equipment health response validation issues (non-blocking):",
      JSON.stringify(result.error.issues, null, 2)
    );
    return normalizedResponse;
  }
  return result.data;
}
