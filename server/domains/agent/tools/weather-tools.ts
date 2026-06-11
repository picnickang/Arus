import { z } from "zod";
import { db } from "../../../db";
import { eq, and, sql } from "drizzle-orm";
import { vessels } from "@shared/schema";
import { registerTool, getTool } from "./registry";
import { fetchWithCacheFallback } from "../infrastructure/external-data-cache";
import type { ToolContext } from "../domain/types";

import {
  WEATHER_CACHE_TTL_SEC,
  fetchMarineWeather,
  weatherRiskSchema,
  type MarineWeatherData,
} from "./weather-support";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

registerTool({
  name: "getMarineWeather",
  category: "fleet",
  riskLevel: "read",
  description:
    "Get current marine weather and sea state conditions for a vessel's position or a specific lat/lng coordinate. " +
    "Returns wind speed (knots), wave height, Beaufort scale, sea state classification, operational risk level, and safety advisories. " +
    "Includes a 12-hour forecast when available. Data is cached so results are available even when the vessel is offline (with a staleness indicator).",
  parameters: {
    type: "object",
    properties: {
      vesselId: {
        type: "string",
        description:
          "Vessel ID — will look up the vessel's last known position. Provide either vesselId or lat/lng.",
      },
      lat: {
        type: "number",
        description: "Latitude (decimal degrees). Use with lng as an alternative to vesselId.",
      },
      lng: {
        type: "number",
        description: "Longitude (decimal degrees). Use with lat as an alternative to vesselId.",
      },
    },
    required: [],
  },
  inputSchema: z.object({
    vesselId: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
  requiresApproval: false,
  async execute(input: { vesselId?: string; lat?: number; lng?: number }, ctx) {
    let lat = input.lat;
    let lng = input.lng;
    let vesselName: string | undefined;

    // Resolve vessel position if vesselId given
    if (input.vesselId && (lat == null || lng == null)) {
      const [vessel] = await db
        .select()
        .from(vessels)
        .where(and(eq(vessels.id, input.vesselId), eq(vessels.orgId, ctx.orgId)));

      if (!vessel) {
        return { error: `Vessel ${input.vesselId} not found` };
      }

      vesselName = vessel.name;

      try {
        const posResult = await db.execute(sql`
          SELECT latitude, longitude FROM weather_cache
          WHERE vessel_id = ${input.vesselId} AND org_id = ${ctx.orgId}
          ORDER BY fetched_at DESC LIMIT 1
        `);
        const posRows = (posResult as { rows?: Array<Record<string, unknown>> }).rows || [];
        const firstPos = posRows[0];
        if (firstPos) {
          lat = Number(firstPos["latitude"]);
          lng = Number(firstPos["longitude"]);
        }
      } catch {
        // weather_cache may not exist in local/SQLite mode — fall through to error
      }

      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
        return {
          error: `No position data available for vessel ${vessel.name}. Provide lat/lng coordinates manually.`,
          vesselId: input.vesselId,
          vesselName: vessel.name,
        };
      }
    }

    if (lat == null || lng == null) {
      return { error: "Either vesselId (with position data) or lat/lng coordinates are required." };
    }

    const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}`;

    const result = await fetchWithCacheFallback<MarineWeatherData>(
      ctx.orgId,
      "weather",
      cacheKey,
      () => fetchMarineWeather(lat!, lng!),
      WEATHER_CACHE_TTL_SEC
    );

    return {
      ...result.data,
      ...(vesselName ? { vesselName } : {}),
      _meta: {
        fromCache: result.fromCache,
        stale: result.stale,
        dataAge: result.ageLabel,
        fetchError: result.fetchError,
      },
    };
  },
});

registerTool({
  name: "getWeatherRiskForMaintenance",
  category: "maintenance",
  riskLevel: "read",
  description:
    "Assess whether current or forecast weather conditions are suitable for a planned maintenance activity. " +
    "Combines weather data with the type of work (deck work, crane operations, enclosed space, etc.) " +
    "to give a go/no-go recommendation.",
  parameters: {
    type: "object",
    properties: {
      vesselId: { type: "string", description: "Vessel ID to check weather for" },
      activityType: {
        type: "string",
        enum: [
          "deck_work",
          "crane_lifting",
          "hull_inspection",
          "enclosed_space",
          "engine_room",
          "general",
        ],
        description: "Type of maintenance activity planned",
      },
      lat: { type: "number", description: "Override latitude" },
      lng: { type: "number", description: "Override longitude" },
    },
    required: ["activityType"],
  },
  inputSchema: z.object({
    vesselId: z.string().optional(),
    activityType: z.enum([
      "deck_work",
      "crane_lifting",
      "hull_inspection",
      "enclosed_space",
      "engine_room",
      "general",
    ]),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  requiresApproval: false,
  async execute(rawInput: Record<string, unknown>, ctx: ToolContext) {
    const input = weatherRiskSchema.parse(rawInput);
    // Reuse getMarineWeather for the data fetch
    const weatherTool = getTool("getMarineWeather");
    if (!weatherTool) {
      return { error: "Weather tool not available" };
    }

    const rawWeather = await weatherTool.execute(
      { vesselId: input.vesselId, lat: input.lat, lng: input.lng },
      ctx
    );
    const weatherResult = rawWeather as Record<string, unknown> &
      Partial<MarineWeatherData> & { error?: string; _meta?: Record<string, unknown> };

    if (weatherResult.error) {
      return weatherResult;
    }

    const wind = weatherResult.current?.windSpeedKnots ?? 0;
    const wave = weatherResult.current?.waveHeightM ?? 0;
    const activity = input.activityType;

    // Activity-specific thresholds (knots / wave height in metres)
    const thresholds: Record<string, { maxWind: number; maxWave: number }> = {
      crane_lifting: { maxWind: 20, maxWave: 1.5 },
      deck_work: { maxWind: 25, maxWave: 2.5 },
      hull_inspection: { maxWind: 15, maxWave: 1.0 },
      enclosed_space: { maxWind: 40, maxWave: 4.0 }, // less weather-sensitive
      engine_room: { maxWind: 50, maxWave: 6.0 },
      general: { maxWind: 30, maxWave: 3.0 },
    };

    const t = thresholds[activity] ?? thresholds["general"] ?? { maxWind: 30, maxWave: 3.0 };
    const windOk = wind <= t.maxWind;
    const waveOk = wave <= t.maxWave;
    const goNoGo = windOk && waveOk ? "GO" : "NO-GO";

    const reasons: string[] = [];
    if (!windOk) {
      reasons.push(
        `Wind ${wind} kts exceeds ${t.maxWind} kts limit for ${activity.replace(/_/g, " ")}`
      );
    }
    if (!waveOk) {
      reasons.push(
        `Wave height ${wave}m exceeds ${t.maxWave}m limit for ${activity.replace(/_/g, " ")}`
      );
    }

    return {
      recommendation: goNoGo,
      activityType: activity,
      currentConditions: {
        windSpeedKnots: wind,
        waveHeightM: wave,
        beaufortScale: weatherResult.beaufortScale,
        seaState: weatherResult.seaState,
      },
      thresholds: t,
      reasons: reasons.length > 0 ? reasons : ["Conditions within acceptable limits"],
      advisories: weatherResult.advisories,
      operationalRisk: weatherResult.operationalRisk,
      _meta: weatherResult._meta,
    };
  },
});
