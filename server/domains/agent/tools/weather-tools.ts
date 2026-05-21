import { z } from "zod";
import { db } from "../../../db";
import { eq, and, sql } from "drizzle-orm";
import { vessels } from "@shared/schema";
import { registerTool, getTool } from "./registry";
import { fetchWithCacheFallback } from "../infrastructure/external-data-cache";

// ---------------------------------------------------------------------------
// Config — swap the provider URL and key for your chosen marine weather API
// (StormGlass, OpenWeatherMap maritime, WorldWeatherOnline, etc.)
// ---------------------------------------------------------------------------

const WEATHER_API_BASE = process.env.MARINE_WEATHER_API_URL || "https://api.stormglass.io/v2";
const WEATHER_API_KEY = process.env.MARINE_WEATHER_API_KEY || "";
const WEATHER_CACHE_TTL_SEC = 1800; // 30 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarineWeatherData {
  location: { lat: number; lng: number; name?: string };
  current: {
    windSpeedKnots: number | null;
    windDirection: number | null;
    windDirectionCardinal: string | null;
    waveHeightM: number | null;
    wavePeriodSec: number | null;
    waveDirection: number | null;
    seaSurfaceTempC: number | null;
    airTempC: number | null;
    visibility: number | null;
    humidity: number | null;
    pressure: number | null;
    cloudCover: number | null;
    precipitation: number | null;
    description: string | null;
  };
  beaufortScale: number | null;
  seaState: string | null;
  operationalRisk: "low" | "moderate" | "high" | "severe";
  advisories: string[];
  forecastHours?: Array<{
    time: string;
    windSpeedKnots: number | null;
    waveHeightM: number | null;
    description: string | null;
  }>;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function beaufortFromKnots(knots: number): number {
  if (knots < 1) {
    return 0;
  }
  if (knots <= 3) {
    return 1;
  }
  if (knots <= 6) {
    return 2;
  }
  if (knots <= 10) {
    return 3;
  }
  if (knots <= 16) {
    return 4;
  }
  if (knots <= 21) {
    return 5;
  }
  if (knots <= 27) {
    return 6;
  }
  if (knots <= 33) {
    return 7;
  }
  if (knots <= 40) {
    return 8;
  }
  if (knots <= 47) {
    return 9;
  }
  if (knots <= 55) {
    return 10;
  }
  if (knots <= 63) {
    return 11;
  }
  return 12;
}

function seaStateFromWaveHeight(m: number): string {
  if (m < 0.1) {
    return "Calm (glassy)";
  }
  if (m <= 0.1) {
    return "Calm (rippled)";
  }
  if (m <= 0.5) {
    return "Smooth";
  }
  if (m <= 1.25) {
    return "Slight";
  }
  if (m <= 2.5) {
    return "Moderate";
  }
  if (m <= 4) {
    return "Rough";
  }
  if (m <= 6) {
    return "Very rough";
  }
  if (m <= 9) {
    return "High";
  }
  if (m <= 14) {
    return "Very high";
  }
  return "Phenomenal";
}

function assessOperationalRisk(
  windKnots: number | null,
  waveM: number | null
): { risk: "low" | "moderate" | "high" | "severe"; advisories: string[] } {
  const advisories: string[] = [];
  let risk: "low" | "moderate" | "high" | "severe" = "low";

  const w = windKnots ?? 0;
  const h = waveM ?? 0;

  if (w >= 48) {
    risk = "severe";
    advisories.push("Storm-force winds — suspend all deck operations");
  } else if (w >= 34) {
    risk = "high";
    advisories.push("Gale-force winds — restrict non-essential deck work");
  } else if (w >= 22) {
    risk = atLeast(risk, "moderate");
    advisories.push("Strong breeze — exercise caution with crane/lifting ops");
  }

  if (h >= 6) {
    risk = atLeast(risk, "severe");
    advisories.push("Very rough seas — risk of structural stress, secure all cargo");
  } else if (h >= 4) {
    risk = atLeast(risk, "high");
    advisories.push("Rough seas — limit personnel on deck");
  } else if (h >= 2.5) {
    risk = atLeast(risk, "moderate");
    advisories.push("Moderate seas — monitor crew fatigue from vessel motion");
  }

  if (advisories.length === 0) {
    advisories.push("Conditions nominal — no weather-related restrictions");
  }

  return { risk, advisories };
}

const RISK_ORDER = { low: 0, moderate: 1, high: 2, severe: 3 } as const;
function atLeast(
  current: "low" | "moderate" | "high" | "severe",
  candidate: "low" | "moderate" | "high" | "severe"
): "low" | "moderate" | "high" | "severe" {
  return RISK_ORDER[candidate] > RISK_ORDER[current] ? candidate : current;
}

function degreesToCardinal(deg: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

/**
 * Actual API fetch.  Adapt this to whichever provider you use.
 * This is structured for StormGlass but the shape is provider-agnostic once
 * mapped into MarineWeatherData.
 */
async function fetchMarineWeather(lat: number, lng: number): Promise<MarineWeatherData> {
  if (!WEATHER_API_KEY) {
    throw new Error("MARINE_WEATHER_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    params:
      "windSpeed,windDirection,waveHeight,wavePeriod,waveDirection,waterTemperature,airTemperature,visibility,humidity,pressure,cloudCover,precipitation",
  });

  const response = await fetch(`${WEATHER_API_BASE}/weather/point?${params}`, {
    headers: { Authorization: WEATHER_API_KEY },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `Weather API returned ${response.status}: ${await response.text().catch(() => "")}`
    );
  }

  const body = await response.json();
  const hours = body.hours || [];
  const now = hours[0] || {};

  // StormGlass returns arrays of source values per param — take the first (sg average)
  const pick = (obj: Record<string, unknown>, key: string): number | null => {
    const val = obj[key];
    if (val && typeof val === "object" && "sg" in (val as Record<string, unknown>)) {
      return (val as Record<string, number>).sg ?? null;
    }
    if (typeof val === "number") {
      return val;
    }
    return null;
  };

  const windSpeedMs = pick(now, "windSpeed");
  const windSpeedKnots = windSpeedMs != null ? Math.round(windSpeedMs * 1.944) : null;
  const windDir = pick(now, "windDirection");
  const waveHeight = pick(now, "waveHeight");

  const { risk, advisories } = assessOperationalRisk(windSpeedKnots, waveHeight);

  const data: MarineWeatherData = {
    location: { lat, lng },
    current: {
      windSpeedKnots,
      windDirection: windDir,
      windDirectionCardinal: windDir != null ? degreesToCardinal(windDir) : null,
      waveHeightM: waveHeight != null ? Math.round(waveHeight * 10) / 10 : null,
      wavePeriodSec: pick(now, "wavePeriod"),
      waveDirection: pick(now, "waveDirection"),
      seaSurfaceTempC: pick(now, "waterTemperature"),
      airTempC: pick(now, "airTemperature"),
      visibility: pick(now, "visibility"),
      humidity: pick(now, "humidity"),
      pressure: pick(now, "pressure"),
      cloudCover: pick(now, "cloudCover"),
      precipitation: pick(now, "precipitation"),
      description: null,
    },
    beaufortScale: windSpeedKnots != null ? beaufortFromKnots(windSpeedKnots) : null,
    seaState: waveHeight != null ? seaStateFromWaveHeight(waveHeight) : null,
    operationalRisk: risk,
    advisories,
    forecastHours: hours.slice(1, 13).map((h: Record<string, unknown>) => {
      const ws = pick(h, "windSpeed");
      return {
        time: h.time as string,
        windSpeedKnots: ws != null ? Math.round(ws * 1.944) : null,
        waveHeightM: pick(h, "waveHeight"),
        description: null,
      };
    }),
    fetchedAt: new Date().toISOString(),
  };

  return data;
}

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
        if (posRows.length > 0) {
          lat = Number(posRows[0].latitude);
          lng = Number(posRows[0].longitude);
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
  execute: (async (input: any, ctx: any) => {
    // Reuse getMarineWeather for the data fetch
    const weatherTool = getTool("getMarineWeather");
    if (!weatherTool) {
      return { error: "Weather tool not available" };
    }

    const weatherResult = (await weatherTool.execute(
      { vesselId: input.vesselId, lat: input.lat, lng: input.lng },
      ctx
    )) as object as MarineWeatherData & { error?: string; _meta?: Record<string, unknown> };

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

    const t = thresholds[activity] || thresholds.general;
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
  }) as object as Parameters<typeof registerTool>[0]["execute"],
});
