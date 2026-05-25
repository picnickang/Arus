/**
 * STCW Compliance Types
 */

export interface RestDay {
  date: string;
  h0?: number | undefined;
  h1?: number | undefined;
  h2?: number | undefined;
  h3?: number | undefined;
  h4?: number | undefined;
  h5?: number | undefined;
  h6?: number | undefined;
  h7?: number | undefined;
  h8?: number | undefined;
  h9?: number | undefined;
  h10?: number | undefined;
  h11?: number | undefined;
  h12?: number | undefined;
  h13?: number | undefined;
  h14?: number | undefined;
  h15?: number | undefined;
  h16?: number | undefined;
  h17?: number | undefined;
  h18?: number | undefined;
  h19?: number | undefined;
  h20?: number | undefined;
  h21?: number | undefined;
  h22?: number | undefined;
  h23?: number | undefined;
  [key: string]: string | number | undefined;
}

export interface RestChunk {
  start: number;
  end: number;
}

export interface DayComplianceResult {
  date: string;
  rest_total: number;
  min_rest_24: number;
  chunks: RestChunk[];
  split_ok: boolean;
  day_ok: boolean;
}

export interface RollingComplianceResult {
  end_date: string;
  rest_7d: number;
  ok: boolean;
}

export interface MonthComplianceResult {
  ok: boolean;
  days: DayComplianceResult[];
  rolling7d: RollingComplianceResult[];
}

export interface FatigueMetrics {
  sleepDebt24h: number;
  sleepDebt7d: number;
  consecutiveNightShifts: number;
  timeSinceLastFullRest: number;
  nightWorkRatio: number;
  avgRestPer24h: number;
  avgRestPer7d: number;
}

export interface FatigueRiskResult {
  crewId: string;
  crewName?: string | undefined;
  riskLevel: "low" | "medium" | "high" | "critical";
  score: number;
  metrics: FatigueMetrics;
  factors: string[];
  recommendations: string[];
}

export const STCW_MIN_REST_24 = 10;
export const STCW_MIN_REST_7D = 77;
export const NIGHT_HOURS_START = 22;
export const NIGHT_HOURS_END = 6;
export const FULL_REST_THRESHOLD = 8;
