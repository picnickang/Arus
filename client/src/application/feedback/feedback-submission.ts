/**
 * Feedback submission — application layer.
 *
 * Typed, framework-agnostic submission service used by the pilot
 * Feedback / Flags form. No React, no I/O implementation — only the
 * shape and the orchestration around the (currently stubbed) backend
 * write.
 *
 * Why a separate module: the React form must not embed the "what is
 * a valid feedback payload" rules. The component renders state and
 * fires submit; this module owns validation, dispatch, and the
 * pending-backend stub.
 */

export type FeedbackSeverity = "low" | "medium" | "high";

export type FeedbackCategory = "bug" | "suggestion" | "flag";

export interface FeedbackDraft {
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  subject: string;
  description: string;
}

export interface FeedbackValidationError {
  field: keyof FeedbackDraft;
  message: string;
}

export type FeedbackSubmissionResult =
  | { ok: true; trackingId: string; pendingBackend: boolean }
  | { ok: false; errors: FeedbackValidationError[] };

export function validateFeedback(draft: FeedbackDraft): FeedbackValidationError[] {
  const errors: FeedbackValidationError[] = [];
  if (draft.subject.trim().length < 3) {
    errors.push({ field: "subject", message: "Subject must be at least 3 characters." });
  }
  if (draft.subject.length > 120) {
    errors.push({ field: "subject", message: "Subject must be 120 characters or fewer." });
  }
  if (draft.description.trim().length < 10) {
    errors.push({
      field: "description",
      message: "Description must be at least 10 characters.",
    });
  }
  if (draft.description.length > 2000) {
    errors.push({
      field: "description",
      message: "Description must be 2000 characters or fewer.",
    });
  }
  return errors;
}

/**
 * Per-session outbox: list of drafts the user submitted during this
 * tab's lifetime. Used by the Feedback page to render a "Submitted
 * this session" history list. Persisted only to sessionStorage so it
 * disappears with the tab — there is no real backend yet.
 */
export interface FeedbackOutboxEntry extends FeedbackDraft {
  trackingId: string;
  createdAt: string;
}

const FEEDBACK_OUTBOX_KEY = "arus-pilot-feedback-outbox";

function isFeedbackOutboxEntry(value: unknown): value is FeedbackOutboxEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Record<keyof FeedbackOutboxEntry, unknown>>;
  return (
    typeof v.trackingId === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.subject === "string" &&
    typeof v.description === "string" &&
    (v.category === "bug" || v.category === "suggestion" || v.category === "flag") &&
    (v.severity === "low" || v.severity === "medium" || v.severity === "high")
  );
}

/**
 * Read the session feedback outbox. Returns newest-first. Safe to
 * call from SSR / private mode (returns []).
 */
export function listSessionFeedback(): FeedbackOutboxEntry[] {
  try {
    const raw = sessionStorage.getItem(FEEDBACK_OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFeedbackOutboxEntry).slice().reverse();
  } catch {
    return [];
  }
}

/**
 * In-memory tracking-id generator. Sufficient for the pilot — once a
 * real submission endpoint exists, the server should mint the id.
 */
function mintLocalTrackingId(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `FB-${stamp}-${random}`;
}

/**
 * Submit a feedback draft.
 *
 * Currently there is no dedicated backend endpoint for pilot user
 * feedback (the only "/feedback" route on the server lives under the
 * RAG/Knowledge-Base namespace and is not the right target). Until
 * that endpoint exists, we mint a local tracking id, persist the
 * draft to sessionStorage so the user can see "what they sent", and
 * return `pendingBackend: true`. The form surfaces that state in the
 * success toast.
 *
 * When the backend lands, only this function changes — the React
 * form stays as-is.
 */
export async function submitFeedback(
  draft: FeedbackDraft,
): Promise<FeedbackSubmissionResult> {
  const errors = validateFeedback(draft);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const trackingId = mintLocalTrackingId();

  try {
    const existing = sessionStorage.getItem(FEEDBACK_OUTBOX_KEY);
    const parsed: unknown = existing ? JSON.parse(existing) : [];
    // Defend against tampered/legacy session storage — only trust an
    // actual array, otherwise start fresh. Avoids a runtime crash on
    // `queue.push` if a previous version stored something else.
    const queue: FeedbackOutboxEntry[] = Array.isArray(parsed)
      ? parsed.filter(isFeedbackOutboxEntry)
      : [];
    queue.push({ ...draft, trackingId, createdAt: new Date().toISOString() });
    sessionStorage.setItem(FEEDBACK_OUTBOX_KEY, JSON.stringify(queue));
  } catch {
    // Storage unavailable (private mode, SSR). Submission is still
    // considered successful from the form's perspective — the
    // pending-backend stub does not depend on persistence.
  }

  return { ok: true, trackingId, pendingBackend: true };
}
