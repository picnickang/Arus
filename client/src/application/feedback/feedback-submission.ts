/**
 * Feedback submission — application layer.
 *
 * Typed, framework-agnostic submission service used by the pilot
 * Feedback / Flags form. Server-first: reports persist via
 * POST /api/me/feedback; if the server is unreachable they fall back
 * to a per-session outbox so nothing the crew typed is lost silently.
 *
 * Why a separate module: the React form must not embed the "what is
 * a valid feedback payload" rules. The component renders state and
 * fires submit; this module owns validation and dispatch.
 */

export type FeedbackSeverity = "low" | "medium" | "high";

export type FeedbackCategory = "bug" | "suggestion" | "flag";

/**
 * Locations match the preview-panel-3 "Location" select. Kept as a
 * closed enum so a typo here cannot drift between the form and the
 * stored entry — the React component reads `FEEDBACK_LOCATION_OPTIONS`
 * for rendering and never invents its own values.
 */
export type FeedbackLocation =
  | "engine_room"
  | "bridge"
  | "deck"
  | "accommodation"
  | "cargo_hold"
  | "other";

export const FEEDBACK_LOCATION_OPTIONS: Array<{
  value: FeedbackLocation;
  label: string;
}> = [
  { value: "engine_room", label: "Engine Room" },
  { value: "bridge", label: "Bridge" },
  { value: "deck", label: "Deck" },
  { value: "accommodation", label: "Accommodation" },
  { value: "cargo_hold", label: "Cargo Hold" },
  { value: "other", label: "Other" },
];

export interface FeedbackDraft {
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  location: FeedbackLocation;
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

const ALLOWED_LOCATIONS: ReadonlySet<FeedbackLocation> = new Set(
  FEEDBACK_LOCATION_OPTIONS.map((o) => o.value)
);

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
  if (!ALLOWED_LOCATIONS.has(draft.location)) {
    errors.push({
      field: "location",
      message: "Pick a location.",
    });
  }
  return errors;
}

/**
 * Per-session outbox: reports that could NOT reach the server (offline /
 * POST failed). The Feedback page shows these as "pending sync" alongside
 * the server-persisted history from GET /api/me/feedback. Successful
 * submissions are never written here — the server row is the record.
 */
export interface FeedbackOutboxEntry extends FeedbackDraft {
  trackingId: string;
  createdAt: string;
}

const FEEDBACK_OUTBOX_KEY = "arus-pilot-feedback-outbox";

function isFeedbackOutboxEntryShape(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
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
 * Normalise a stored outbox entry into the canonical
 * `FeedbackOutboxEntry` shape:
 *   - `location` field was added in Phase 5. Legacy entries (no
 *     location) and tampered entries (unknown location string) are
 *     coerced to "other" so the typed return contract holds without
 *     dropping the row.
 *   - Returns null for rows that fail the base-shape guard — those
 *     are truly corrupt and have to be skipped.
 */
function normaliseOutboxEntry(value: unknown): FeedbackOutboxEntry | null {
  if (!isFeedbackOutboxEntryShape(value)) {
    return null;
  }
  const raw = value as Record<string, unknown> &
    Omit<FeedbackOutboxEntry, "location"> & {
      location?: unknown;
    };
  const candidateLocation =
    typeof raw.location === "string" ? (raw.location as FeedbackLocation) : undefined;
  const location: FeedbackLocation =
    candidateLocation !== undefined && ALLOWED_LOCATIONS.has(candidateLocation)
      ? candidateLocation
      : "other";
  return {
    trackingId: raw.trackingId,
    createdAt: raw.createdAt,
    category: raw.category,
    severity: raw.severity,
    subject: raw.subject,
    description: raw.description,
    location,
  };
}

/**
 * Read the session feedback outbox. Returns newest-first. Safe to
 * call from SSR / private mode (returns []).
 */
export function listSessionFeedback(): FeedbackOutboxEntry[] {
  try {
    const raw = sessionStorage.getItem(FEEDBACK_OUTBOX_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalised: FeedbackOutboxEntry[] = [];
    for (const row of parsed) {
      const entry = normaliseOutboxEntry(row);
      if (entry) {
        normalised.push(entry);
      }
    }
    return normalised.reverse();
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

/** Server-persisted feedback row as returned by GET /api/me/feedback. */
export interface ServerFeedbackEntry extends FeedbackOutboxEntry {
  status: "submitted" | "acknowledged" | "resolved";
  resolutionNote?: string | null;
  linkedWorkOrderId?: string | null;
}

/** Pluggable transport so tests can exercise both paths deterministically. */
export interface FeedbackTransport {
  post: (draft: FeedbackDraft) => Promise<{ trackingId: string }>;
}

const defaultTransport: FeedbackTransport = {
  post: async (draft) => {
    // /api/me/feedback is NOT an offline-queueable prefix (see
    // shared/offline-queue-routes.ts), so offline this rejects and the
    // session-outbox fallback below takes over — no double submission.
    // Lazy import keeps this module import-safe in the node-env unit
    // tests (queryClient touches browser APIs at module scope).
    const { apiRequest } = await import("@/lib/queryClient");
    const row = await apiRequest<{ trackingId?: string }>("POST", "/api/me/feedback", draft);
    if (!row?.trackingId) {
      throw new Error("Feedback POST returned no tracking id");
    }
    return { trackingId: row.trackingId };
  },
};

function writeToOutbox(draft: FeedbackDraft, trackingId: string): void {
  try {
    const existing = sessionStorage.getItem(FEEDBACK_OUTBOX_KEY);
    const parsed: unknown = existing ? JSON.parse(existing) : [];
    // Defend against tampered/legacy session storage — only trust an
    // actual array, otherwise start fresh. Avoids a runtime crash on
    // `queue.push` if a previous version stored something else.
    const queue: FeedbackOutboxEntry[] = Array.isArray(parsed)
      ? parsed
          .map((row) => normaliseOutboxEntry(row))
          .filter((row): row is FeedbackOutboxEntry => row !== null)
      : [];
    queue.push({
      ...draft,
      trackingId,
      createdAt: new Date().toISOString(),
    });
    sessionStorage.setItem(FEEDBACK_OUTBOX_KEY, JSON.stringify(queue));
  } catch {
    // Storage unavailable (private mode, SSR). Submission is still
    // considered successful from the form's perspective.
  }
}

/**
 * Submit a feedback draft.
 *
 * Online-first: the report is persisted via POST /api/me/feedback and the
 * server mints the tracking id (`pendingBackend: false`). If the request
 * fails — offline at sea, server unreachable — the report is kept in the
 * per-session outbox with a locally minted id and `pendingBackend: true`,
 * which the form surfaces in the success toast.
 */
export async function submitFeedback(
  draft: FeedbackDraft,
  transport: FeedbackTransport = defaultTransport
): Promise<FeedbackSubmissionResult> {
  const errors = validateFeedback(draft);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  try {
    const { trackingId } = await transport.post(draft);
    return { ok: true, trackingId, pendingBackend: false };
  } catch {
    const trackingId = mintLocalTrackingId();
    writeToOutbox(draft, trackingId);
    return { ok: true, trackingId, pendingBackend: true };
  }
}
