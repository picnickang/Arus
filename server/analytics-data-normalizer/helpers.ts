/**
 * Analytics Data Normalizer - Helper Functions
 */

export function expandAnomalyType(type: string | null | undefined): string {
  if (!type) { return "statistical"; }

  const abbreviationMap: Record<string, string> = {
    stat: "statistical",
    patt: "pattern",
    trnd: "trend",
    seas: "seasonal",
    bflt: "bearing_fault",
    imbal: "imbalance",
    misal: "misalignment",
    loose: "looseness",
  };

  return abbreviationMap[type.toLowerCase()] || type;
}

export function expandRiskLevel(level: string | null | undefined): "low" | "medium" | "high" | "critical" {
  if (!level) { return "medium"; }

  const abbreviationMap: Record<string, "low" | "medium" | "high" | "critical"> = {
    l: "low",
    lo: "low",
    m: "medium",
    med: "medium",
    h: "high",
    hi: "high",
    c: "critical",
    crit: "critical",
  };

  const normalized = level.toLowerCase();
  return abbreviationMap[normalized] || (level as any);
}

export function expandFailureMode(mode: string | null | undefined): string {
  if (!mode) { return "unknown"; }

  const abbreviationMap: Record<string, string> = {
    wr: "wear",
    ftg: "fatigue",
    ovld: "overload",
    corr: "corrosion",
    vib: "vibration",
    temp: "temperature",
    lub: "lubrication",
    elec: "electrical",
  };

  return abbreviationMap[mode.toLowerCase()] || mode;
}

export function clampToRange(value: number | null | undefined, min: number, max: number): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (min + max) / 2;
  }
  return Math.max(min, Math.min(max, value));
}
