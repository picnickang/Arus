// -------------------------------------------------------------------------
// AI Insights / LLM-side types
// -------------------------------------------------------------------------

export type ReportType = "health" | "fleet" | "maintenance" | "compliance";

export type AudienceType = "executive" | "engineer" | "technician" | "regulator";

/** Identifier strings for LLM models exposed by the platform (gpt-4o, claude, etc.). */
export type LlmModelType =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4-turbo"
  | "claude-sonnet-4-5"
  | "claude-opus-4-1"
  | "claude-haiku-4-5"
  | string;

/**
 * LLM model record returned by /api/llm/models. The shape is intentionally
 * loose because the backend currently aggregates from multiple providers.
 */
export interface AIModel {
  id: string;
  name: string;
  provider?: string;
  contextWindow?: number;
  description?: string;
  available?: boolean;
  [key: string]: unknown;
}

/** Audience selector record returned by /api/llm/models. */
export interface Audience {
  id: string;
  label: string;
  description?: string;
  [key: string]: unknown;
}

/** Scenario block inside a generated AI report. */
export interface ReportScenario {
  impact: string;
  probability: number;
  scenario: string;
  recommendations: string[];
}

/** ROI block inside a generated AI report. */
export interface ReportROI {
  estimatedSavings: number;
  investmentRequired: number;
  paybackPeriod: number;
  riskReduction: number;
}

/** Citation block inside a generated AI report. */
export interface ReportCitation {
  relevance: number;
  source: string;
  snippet: string;
}

/**
 * Provider-shaped content returned by the LLM report endpoints. All fields
 * are optional because providers vary; consumers should defensively check
 * presence before rendering.
 */
export interface ReportContent {
  summary?: string;
  analysis?: string;
  recommendations?: string[];
  scenarios?: ReportScenario[];
  roi?: ReportROI;
  citations?: ReportCitation[];
  [key: string]: unknown;
}

/** Generated AI report payload returned from POST /api/llm/reports/*. */
export interface GeneratedReport {
  reportType: ReportType;
  audience: AudienceType;
  model: LlmModelType;
  content: ReportContent;
  timestamp: string;
}

/** Vessel-level intelligence payload returned from /api/llm/vessel/:id/intelligence. */
export interface VesselIntelligence {
  vesselId: string;
  vesselName: string;
  lookbackDays?: number;
  findings?: unknown[];
  recommendations?: string[];
  generatedAt?: string;
  [key: string]: unknown;
}

/**
 * Display-friendly projection of an ML model row used by the training UI.
 * Server may return additional fields; consumers should treat unknown ones
 * as opaque.
 */
export interface MlModelDisplay {
  id: string;
  name: string;
  modelType: string;
  status: string;
  accuracy?: number | null;
  version?: string;
  targetMetric?: string;
  equipmentType?: string | null;
  targetEquipmentType?: string | null;
  trainedAt?: string | Date | null;
  lastUsedAt?: string | Date | null;
  createdAt?: string | Date | null;
  hyperparameters?: {
    dataQualityTier?: string;
    lookbackDays?: number;
    [key: string]: unknown;
  } | null;
  performance?: {
    accuracy?: number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}
