/**
 * RUL Engine Enhancement Utilities
 * Production-grade helpers for mode-aware, data-quality-conscious RUL predictions
 *
 * Enhancements:
 * 1. Operating mode threshold adjustments
 * 2. Data quality scoring (4-factor model)
 * 3. Failure probability calibration
 * 4. Mode derivation from telemetry
 */

/**
 * Operating modes supported by the RUL engine
 * Aligned with server/context/mode-detector.ts
 */
export type OpMode =
  | "DP" // Dynamic Positioning
  | "TRANSIT" // Underway transit
  | "HARBOR" // Harbor operations
  | "CARGO_OPS" // Cargo operations
  | "STANDBY" // Idle/standby
  | "DOCKING" // Docking operations
  | "UNKNOWN"; // Cannot determine

const TAG_PRIORITY_ORDER: OpMode[] = ["DP", "DOCKING", "CARGO_OPS", "HARBOR", "TRANSIT", "STANDBY"];
const TAG_ALIASES: Record<string, OpMode> = {
  "DP": "DP",
  "DOCKING": "DOCKING",
  "CARGO_OPS": "CARGO_OPS",
  "CARGO": "CARGO_OPS",
  "HARBOR": "HARBOR",
  "TRANSIT": "TRANSIT",
  "STANDBY": "STANDBY",
};

const MODE_STRING_MAP: Record<string, OpMode> = {
  "DP": "DP",
  "DYNAMIC POSITIONING": "DP",
  "TRANSIT": "TRANSIT",
  "UNDERWAY": "TRANSIT",
  "HARBOR": "HARBOR",
  "HARBOUR": "HARBOR",
  "CARGO_OPS": "CARGO_OPS",
  "CARGO OPERATIONS": "CARGO_OPS",
  "CARGO": "CARGO_OPS",
  "STANDBY": "STANDBY",
  "IDLE": "STANDBY",
  "DOCKING": "DOCKING",
  "UNDOCKING": "DOCKING",
};

function deriveFromTags(tags: string[]): OpMode | null {
  const upperTags = new Set(tags.map((t) => t.toUpperCase()));
  for (const mode of TAG_PRIORITY_ORDER) {
    for (const [alias, mappedMode] of Object.entries(TAG_ALIASES)) {
      if (mappedMode === mode && upperTags.has(alias)) {
        return mode;
      }
    }
  }
  return null;
}

function deriveFromModeString(operatingMode: string): OpMode | null {
  const normalized = operatingMode.toUpperCase().trim();
  return MODE_STRING_MAP[normalized] || null;
}

/**
 * Derive operating mode from tags or operating mode string
 */
export function deriveOpMode(tags?: string[], operatingMode?: string): OpMode {
  if (tags?.length) {
    const fromTags = deriveFromTags(tags);
    if (fromTags) {return fromTags;}
  }
  if (operatingMode) {
    const fromString = deriveFromModeString(operatingMode);
    if (fromString) {return fromString;}
  }
  return "UNKNOWN";
}

/**
 * Calculate data quality score using 4-factor model
 *
 * Factors (weighted):
 * - Sample quantity (35%): More data points = higher quality
 * - Time span coverage (25%): Wider time window = better trends
 * - Missing data (25%): Less missing values = higher quality
 * - Freshness (15%): Recent data = more relevant
 *
 * @param sampleCount - Number of data points available
 * @param spanDays - Time span covered by data (in days)
 * @param missingPct - Percentage of missing/null values (0-1)
 * @param stalenessMin - Minutes since last data reading
 * @returns Quality score between 0 (poor) and 1 (excellent)
 *
 * @example
 * // Perfect data: 500 points, 30 days, 0% missing, 0 min stale
 * dataQualityScore(500, 30, 0, 0) // => 1
 *
 * // Poor data: 10 points, 3 days, 20% missing, 1440 min (24h) stale
 * dataQualityScore(10, 3, 0.2, 1440) // => 0.17
 */
export function dataQualityScore(
  sampleCount: number,
  spanDays: number,
  missingPct: number,
  stalenessMin: number
): number {
  // Sample quantity score (cap at 500 points)
  const quantityScore = Math.min(1, sampleCount / 500);

  // Time span score (cap at 30 days)
  const spanScore = Math.min(1, spanDays / 30);

  // Missing data score (invert: less missing = better)
  const missingScore = 1 - Math.min(1, missingPct);

  // Freshness score (0 after 24h stale)
  const freshnessScore = Math.max(0, 1 - stalenessMin / 1440);

  // Weighted average (35%, 25%, 25%, 15%)
  const weightedScore =
    0.35 * quantityScore + 0.25 * spanScore + 0.25 * missingScore + 0.15 * freshnessScore;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, weightedScore));
}

/**
 * Get RUL threshold multiplier based on operating mode
 *
 * Different operating modes have different criticality levels:
 * - DP (Dynamic Positioning): Most critical, strictest thresholds (0.85x)
 * - Docking: Critical maneuvering, strict (0.90x)
 * - Cargo Operations: Moderate criticality (0.95x)
 * - Transit: Baseline operations (1x)
 * - Harbor: Less critical, lenient (1.1x)
 * - Standby: Least critical, most lenient (1.2x)
 *
 * Lower multiplier = earlier warnings (shorter RUL)
 * Higher multiplier = later warnings (longer RUL)
 *
 * @param mode - Operating mode
 * @returns Threshold multiplier (0.85-1.2)
 *
 * @example
 * // DP equipment needs earlier warnings
 * modeThresholdMultiplier('DP') // => 0.85
 *
 * // Standby equipment can be more lenient
 * modeThresholdMultiplier('STANDBY') // => 1.2
 *
 * // Apply to RUL: remainingDays = 30 * 0.85 = 25.5 days (DP mode)
 */
const modeThresholdMultipliers: Record<OpMode, number> = {
  DP: 0.85,         // Stricter: DP operations are critical, equipment failure is high-risk
  DOCKING: 0.9,     // Strict: Docking/undocking requires reliability
  CARGO_OPS: 0.95,  // Moderate: Cargo ops need equipment availability
  TRANSIT: 1,       // Baseline: Standard operations, neutral threshold
  HARBOR: 1.1,      // Lenient: Harbor ops have shore support available
  STANDBY: 1.2,     // Most lenient: Equipment idle, maintenance can be scheduled
  UNKNOWN: 1,       // Default to baseline when mode unknown
};

export function modeThresholdMultiplier(mode: OpMode): number {
  return modeThresholdMultipliers[mode] ?? 1;
}

/**
 * Calibrate failure probability toward observed base rate
 *
 * ML models can be overconfident (predicting 95% when actual rate is 15%).
 * This applies isotonic-like calibration to pull extreme probabilities
 * toward the empirical base rate.
 *
 * Formula: calibrated = (1-α) * p_ml + α * p_base
 * where α = 0.2 (20% pull toward base rate)
 *
 * @param p - Raw probability from ML model (0-1)
 * @param baseRate - Observed failure rate for equipment type (0-1)
 * @returns Calibrated probability (0.01-0.99, clamped)
 *
 * @example
 * // ML predicts 95% failure, but base rate is only 15%
 * calibrateFailureProb(0.95, 0.15) // => 0.79 (80% ML + 20% base)
 *
 * // ML predicts 5% failure, but base rate is 30%
 * calibrateFailureProb(0.05, 0.30) // => 0.10 (80% ML + 20% base)
 *
 * // Extreme values are clamped
 * calibrateFailureProb(1, 0.5) // => 0.99 (never 100% certain)
 * calibrateFailureProb(0, 0.1) // => 0.02 (never 0% certain)
 */
export function calibrateFailureProb(p: number, baseRate: number): number {
  // Calibration weight (alpha): 0.2 = mild pull toward base rate
  // Higher alpha = more aggressive calibration
  // Lower alpha = trust ML more
  const alpha = 0.2;

  // Weighted blend: 80% ML prediction + 20% base rate
  const calibrated = (1 - alpha) * p + alpha * baseRate;

  // Clamp to [0.01, 0.99] - never claim absolute certainty
  return Math.max(0.01, Math.min(0.99, calibrated));
}

/**
 * Get human-readable description of data quality score
 *
 * @param score - Quality score (0-1)
 * @returns Quality level description
 */
export function qualityLevelDescription(score: number): string {
  if (score >= 0.8) { return "Excellent"; }
  if (score >= 0.6) { return "Good"; }
  if (score >= 0.4) { return "Fair"; }
  if (score >= 0.2) { return "Poor"; }
  return "Very Poor";
}

/**
 * Get color code for data quality display
 *
 * @param score - Quality score (0-1)
 * @returns Hex color code
 */
export function qualityLevelColor(score: number): string {
  if (score >= 0.8) { return "#10b981"; } // green
  if (score >= 0.6) { return "#f59e0b"; } // amber
  if (score >= 0.4) { return "#f97316"; } // orange
  return "#ef4444"; // red
}
