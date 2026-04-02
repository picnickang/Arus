export const PIPELINE_STAGE_KEYS = [
  "request_created",
  "sent_to_supplier",
  "quote_received",
  "po_issued",
  "shipped",
  "received",
  "fulfilled",
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGE_KEYS)[number];

export interface PipelineStage {
  key: PipelineStageKey;
  label: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  timestamp: string | null;
  actor: string | null;
  details: Record<string, unknown> | null;
}

export interface PurchasePipeline {
  prId: string;
  currentStage: PipelineStageKey;
  stages: PipelineStage[];
}

export interface RawEvent {
  id: string;
  eventType: string;
  userId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date | null;
}

export interface PipelineDataSources {
  prEvents: RawEvent[];
  poEvents: RawEvent[];
  prStatus: string;
  prCreatedAt: Date | null;
  prSentAt: Date | null;
  prClosedAt: Date | null;
}
