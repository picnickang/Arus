/**
 * Row shape returned by GET /api/feedback-review — the full pilot_feedback
 * record plus the submitter's display name (null for dev-login synthetic
 * users). Pure .ts so unit tests can import it under @swc/jest (tsx: false).
 */

export interface ReviewEntry {
  id: string;
  trackingId: string;
  userId: string;
  submitterName: string | null;
  category: "bug" | "suggestion" | "flag";
  severity: "low" | "medium" | "high";
  location: "engine_room" | "bridge" | "deck" | "accommodation" | "cargo_hold" | "other";
  subject: string;
  description: string;
  status: "submitted" | "acknowledged" | "resolved";
  resolutionNote?: string | null;
  linkedWorkOrderId?: string | null;
  createdAt: string | null;
}

export const REVIEW_FILTERS = ["all", "submitted", "acknowledged", "resolved"] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];
