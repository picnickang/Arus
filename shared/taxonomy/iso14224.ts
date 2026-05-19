/**
 * Wave 3.8 — ISO 14224 failure-mode taxonomy.
 *
 * ISO 14224 ("Petroleum, petrochemical and natural gas industries —
 * Collection and exchange of reliability and maintenance data for
 * equipment") defines the de-facto standard set of failure-mode codes
 * used across marine, offshore, oil-and-gas and adjacent industries.
 * Aligning to it unlocks cross-vessel learning and lets reliability
 * engineers compare ARUS data against industry benchmarks (OREDA,
 * SINTEF) without per-customer mapping work.
 *
 * Shipped as a typed const, NOT a database table. Reasons:
 *   - The codes are a slow-changing reference set, not tenant data.
 *     Pinning them in the build means no production fetch on every
 *     lookup and no risk of a tenant editing them.
 *   - Backfilling existing `failureHistory.failureMode` text rows to
 *     these codes is a one-time migration that the data team can run
 *     when they're ready — keeping the taxonomy code-resident now
 *     unblocks new write paths immediately without that prereq.
 *
 * The category buckets (Mechanical / Electrical / Instrument / etc.)
 * follow ISO 14224 Table B.1. Codes use the standard 3-letter form
 * (`LOO`, `VIB`, etc.) so they map directly to OREDA records.
 */

export type Iso14224Category =
  | "mechanical"
  | "electrical"
  | "instrument"
  | "process"
  | "structural"
  | "external"
  | "operational"
  | "unknown";

export interface Iso14224FailureMode {
  /** Canonical 3-letter code from ISO 14224 Table B.1. */
  code: string;
  /** Short human-readable label. */
  label: string;
  /** Category grouping for dashboards and filtering. */
  category: Iso14224Category;
  /** One-line description in plain language. */
  description: string;
}

export const ISO_14224_FAILURE_MODES = [
  // ── Mechanical
  { code: "BRK", label: "Breakdown",            category: "mechanical", description: "Loss of function caused by mechanical breakdown of equipment." },
  { code: "LOO", label: "Loss of output",       category: "mechanical", description: "Equipment does not deliver the specified output (flow, power, torque)." },
  { code: "VIB", label: "Vibration",            category: "mechanical", description: "Excessive vibration above the alarm threshold for the equipment class." },
  { code: "NOI", label: "Abnormal noise",       category: "mechanical", description: "Abnormal acoustic signature outside the equipment's normal envelope." },
  { code: "OVH", label: "Overheating",          category: "mechanical", description: "Temperature exceeds the documented operating limit." },
  { code: "ELP", label: "External leakage — process medium", category: "mechanical", description: "Process fluid leaks to the external environment." },
  { code: "ELU", label: "External leakage — utility medium", category: "mechanical", description: "Utility fluid (lube oil, coolant, hydraulic) leaks to the external environment." },
  { code: "INL", label: "Internal leakage",     category: "mechanical", description: "Process fluid bypasses internal seals or barriers within the equipment." },
  { code: "PDE", label: "Parameter deviation",  category: "mechanical", description: "Operating parameter drifts outside the acceptable band." },
  { code: "STD", label: "Structural deficiency",category: "mechanical", description: "Crack, deformation, or fatigue damage in load-bearing structure." },

  // ── Electrical
  { code: "ERO", label: "Erratic output",       category: "electrical", description: "Output signal or power fluctuates without commanded change." },
  { code: "FTS", label: "Fail to start on demand", category: "electrical", description: "Equipment fails to start when commanded." },
  { code: "FTO", label: "Fail to open",         category: "electrical", description: "Breaker, contactor or valve fails to open on command." },
  { code: "FTC", label: "Fail to close",        category: "electrical", description: "Breaker, contactor or valve fails to close on command." },
  { code: "STP", label: "Spurious stop",        category: "electrical", description: "Equipment stops without commanded shutdown." },
  { code: "FOF", label: "Fail to function on demand", category: "electrical", description: "Component does not perform its intended function when called." },

  // ── Instrument
  { code: "AIR", label: "Abnormal instrument reading", category: "instrument", description: "Sensor reading inconsistent with process state or peer sensors." },
  { code: "NOO", label: "No signal / indication / alarm", category: "instrument", description: "Expected signal, indication or alarm is absent." },
  { code: "FAI", label: "Faulty information",   category: "instrument", description: "Information presented is incorrect (stale, frozen, miscalibrated)." },
  { code: "DOP", label: "Delayed operation",    category: "instrument", description: "Function completes outside the specified response time." },
  { code: "HIO", label: "High output / over-range", category: "instrument", description: "Reading pinned above the upper measurement range." },
  { code: "LOO_I", label: "Low output / under-range", category: "instrument", description: "Reading pinned below the lower measurement range." },

  // ── Process
  { code: "PLU", label: "Plugged / choked",     category: "process",    description: "Flow path is blocked by debris, scale, hydrate, ice or solidified fluid." },
  { code: "CON", label: "Contamination",        category: "process",    description: "Process or utility fluid contaminated outside the acceptable spec." },

  // ── Structural
  { code: "COR", label: "Corrosion",            category: "structural", description: "Loss of material from corrosive attack on metal surfaces." },
  { code: "ERO_S", label: "Erosion",            category: "structural", description: "Loss of material from particle or cavitation impact." },
  { code: "MOF", label: "Mechanical failure — general", category: "structural", description: "Mechanical loss of integrity not covered by a more specific code." },

  // ── Operational / external
  { code: "OHE", label: "Overheating — external cause", category: "external", description: "Heat ingress from an external source drives the equipment above limits." },
  { code: "INF", label: "Insufficient supply / starvation", category: "external", description: "Inadequate feed of fuel, air, coolant or driver power from upstream." },
  { code: "OOP", label: "Out of adjustment",    category: "operational", description: "Equipment is operating outside its commissioned set-points." },

  // ── Unknown / not yet diagnosed
  { code: "UNK", label: "Unknown",              category: "unknown",    description: "Failure mode not yet diagnosed; cause investigation pending." },
  { code: "OTH", label: "Other",                category: "unknown",    description: "Failure mode does not match any other ISO 14224 code in this set." },
] as const satisfies readonly Iso14224FailureMode[];

const CODE_INDEX: Map<string, Iso14224FailureMode> = new Map(
  ISO_14224_FAILURE_MODES.map((m) => [m.code.toUpperCase(), m])
);

/** Look up a failure mode by its ISO 14224 code. Case-insensitive. */
export function getFailureMode(code: string | null | undefined): Iso14224FailureMode | undefined {
  if (!code) return undefined;
  return CODE_INDEX.get(code.toUpperCase());
}

/** True iff `code` is a known ISO 14224 failure-mode code. */
export function isFailureModeCode(code: string | null | undefined): boolean {
  return !!getFailureMode(code);
}

/** All failure modes that belong to a given category. */
export function failureModesByCategory(category: Iso14224Category): readonly Iso14224FailureMode[] {
  return ISO_14224_FAILURE_MODES.filter((m) => m.category === category);
}

/**
 * Coerce a free-text failure-mode string from legacy data into an
 * ISO 14224 code. Returns "OTH" when the input doesn't match any
 * known synonym. Conservative on purpose — better to bucket into
 * "Other" than to silently miscategorize for the cross-vessel
 * benchmarking layer.
 */
const LEGACY_SYNONYMS: Record<string, string> = {
  // common free-text failure descriptions seen in older work-orders
  "bearing failure":           "BRK",
  "seal leak":                 "ELU",
  "oil leak":                  "ELU",
  "coolant leak":              "ELU",
  "high vibration":            "VIB",
  "vibration":                 "VIB",
  "overheat":                  "OVH",
  "overheating":               "OVH",
  "high temperature":          "OVH",
  "low pressure":              "PDE",
  "high pressure":             "PDE",
  "no start":                  "FTS",
  "wont start":                "FTS",
  "won't start":               "FTS",
  "tripped":                   "STP",
  "trip":                      "STP",
  "alarm":                     "AIR",
  "sensor fault":              "FAI",
  "blocked":                   "PLU",
  "clogged":                   "PLU",
  "fouled":                    "PLU",
  "corroded":                  "COR",
  "corrosion":                 "COR",
  "cracked":                   "STD",
  "noise":                     "NOI",
};

export function coerceFailureMode(input: string | null | undefined): string {
  if (!input) return "UNK";
  const trimmed = input.trim();
  if (!trimmed) return "UNK";
  if (isFailureModeCode(trimmed)) return trimmed.toUpperCase();
  const lookup = LEGACY_SYNONYMS[trimmed.toLowerCase()];
  return lookup ?? "OTH";
}
