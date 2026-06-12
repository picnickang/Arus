import { z } from "zod";

export const weatherRiskSchema = z.object({
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
});

// ---------------------------------------------------------------------------
// Config — swap the provider URL and key for your chosen marine weather API
// (StormGlass, OpenWeatherMap maritime, WorldWeatherOnline, etc.)
// ---------------------------------------------------------------------------

const WEATHER_API_BASE = process.env["MARINE_WEATHER_API_URL"] || "https://api.stormglass.io/v2";
const WEATHER_API_KEY = process.env["MARINE_WEATHER_API_KEY"] || "";
export const WEATHER_CACHE_TTL_SEC = 1800; // 30 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarineWeatherData {
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
  return dirs[Math.round(deg / 22.5) % 16] ?? "N";
}

/**
 * Actual API fetch.  Adapt this to whichever provider you use.
 * This is structured for StormGlass but the shape is provider-agnostic once
 * mapped into MarineWeatherData.
 */
export async function fetchMarineWeather(lat: number, lng: number): Promise<MarineWeatherData> {
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
      return (val as Record<string, number>)["sg"] ?? null;
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
        time: h["time"] as string,
        windSpeedKnots: ws != null ? Math.round(ws * 1.944) : null,
        waveHeightM: pick(h, "waveHeight"),
        description: null,
      };
    }),
    fetchedAt: new Date().toISOString(),
  };

  return data;
}
