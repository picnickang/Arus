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
    const key = "arus-pilot-feedback-outbox";
    const existing = sessionStorage.getItem(key);
    const parsed: unknown = existing ? JSON.parse(existing) : [];
    // Defend against tampered/legacy session storage — only trust an
    // actual array, otherwise start fresh. Avoids a runtime crash on
    // `queue.push` if a previous version stored something else.
    const queue: Array<FeedbackDraft & { trackingId: string; createdAt: string }> =
      Array.isArray(parsed) ? parsed : [];
    queue.push({ ...draft, trackingId, createdAt: new Date().toISOString() });
    sessionStorage.setItem(key, JSON.stringify(queue));
  } catch {
    // Storage unavailable (private mode, SSR). Submission is still
    // considered successful from the form's perspective — the
    // pending-backend stub does not depend on persistence.
  }

  return { ok: true, trackingId, pendingBackend: true };
}
