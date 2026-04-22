/**
 * STCW Compliance Types
 */

export interface RestDay {
  date: string;
  h0?: number;
  h1?: number;
  h2?: number;
  h3?: number;
  h4?: number;
  h5?: number;
  h6?: number;
  h7?: number;
  h8?: number;
  h9?: number;
  h10?: number;
  h11?: number;
  h12?: number;
  h13?: number;
  h14?: number;
  h15?: number;
  h16?: number;
  h17?: number;
  h18?: number;
  h19?: number;
  h20?: number;
  h21?: number;
  h22?: number;
  h23?: number;
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
  crewName?: string;
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
