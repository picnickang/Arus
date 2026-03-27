import { logger } from "../utils/logger";

const LOG_CTX = "VesselTimezone";

const vesselTimezones = new Map<string, string>();

export async function getVesselTimezone(vesselId: string, storage: any): Promise<string> {
  const cached = vesselTimezones.get(vesselId);
  if (cached) return cached;

  try {
    const vessel = await storage.getVessel(vesselId);
    const tz = vessel?.timezone || vessel?.vesselTimezone || "UTC";
    vesselTimezones.set(vesselId, tz);
    return tz;
  } catch {
    return "UTC";
  }
}

export function toVesselLocal(utcDate: Date, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const get = (type: string) => parts.find(p => p.type === type)?.value || "0";

    return new Date(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`
    );
  } catch {
    logger.warn(LOG_CTX, `Invalid timezone '${timezone}', falling back to UTC`);
    return utcDate;
  }
}

export function toUTC(localDate: Date, timezone: string): Date {
  try {
    const localStr = localDate.toLocaleString("en-US", { timeZone: timezone });
    const utcStr = localDate.toLocaleString("en-US", { timeZone: "UTC" });
    const offsetMs = new Date(localStr).getTime() - new Date(utcStr).getTime();
    return new Date(localDate.getTime() - offsetMs);
  } catch {
    return localDate;
  }
}

export function getVesselLocalDate(utcDate: Date, timezone: string): string {
  try {
    return utcDate.toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return utcDate.toISOString().split("T")[0];
  }
}

export function clearTimezoneCache(vesselId?: string): void {
  if (vesselId) {
    vesselTimezones.delete(vesselId);
  } else {
    vesselTimezones.clear();
  }
}
