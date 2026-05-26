/**
 * Feedback / Flags — pilot form (UI Align Phase 5).
 *
 * Re-skinned per preview-panel 3 (desktop) and the mobile row-9 sub-
 * flow (Report Issue → Take Photo → Submit Report).
 *
 * Component owns rendering only. ALL validation rules + the
 * sessionStorage write live in
 * `client/src/application/feedback/feedback-submission.ts`. If a new
 * rule is needed it goes there, never inline. There is no real
 * backend yet — the photo is a local-only placeholder that captures
 * a file, shows a thumbnail, and is persisted as lightweight
 * metadata by the submission module. Nothing pretends a network
 * request succeeded.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Flag,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Inbox,
  Camera,
  ImagePlus,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SwitchPortalButton } from "@/components/navigation/SwitchPortalButton";
import {
  FEEDBACK_LOCATION_OPTIONS,
  listSessionFeedback,
  submitFeedback,
  validatePhotoForFeedback,
  type FeedbackCategory,
  type FeedbackDraft,
  type FeedbackLocation,
  type FeedbackOutboxEntry,
  type FeedbackPhotoMeta,
  type FeedbackSeverity,
  type FeedbackValidationError,
} from "@/application/feedback/feedback-submission";

const EMPTY_DRAFT: FeedbackDraft = {
  category: "suggestion",
  severity: "low",
  location: "engine_room",
  subject: "",
  description: "",
  photo: null,
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; trackingId: string; pendingBackend: boolean }
  | { kind: "error"; message: string };

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "suggestion", label: "Suggestion" },
  { value: "bug", label: "Equipment Malfunction" },
  { value: "flag", label: "Flag a Concern" },
];

const SEVERITY_OPTIONS: Array<{
  value: FeedbackSeverity;
  label: string;
  tone: string;
}> = [
  {
    value: "low",
    label: "Low",
    tone: "data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-300 data-[active=true]:ring-emerald-500/40",
  },
  {
    value: "medium",
    label: "Medium",
    tone: "data-[active=true]:bg-amber-500/15 data-[active=true]:text-amber-300 data-[active=true]:ring-amber-500/40",
  },
  {
    value: "high",
    label: "High",
    tone: "data-[active=true]:bg-rose-500/15 data-[active=true]:text-rose-300 data-[active=true]:ring-rose-500/40",
  },
];

function errorFor(
  errors: FeedbackValidationError[],
  field: keyof FeedbackDraft,
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("File read returned non-string result."));
      }
    };
    reader.readAsDataURL(file);
  });
}

function FeedbackHistory({ entries }: { entries: FeedbackOutboxEntry[] }) {
  if (entries.length === 0) {
    return (
      <div
        className="mt-6 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3"
        data-testid="empty-feedback-history"
      >
        <Inbox className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div>
          <div className="text-sm font-medium">No submissions yet</div>
          <div className="text-xs text-muted-foreground">
            Anything you send in this session will appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6" data-testid="list-feedback-history">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Submitted this session
      </h3>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.trackingId}
            className="rounded-md border bg-card p-3"
            data-testid={`feedback-entry-${entry.trackingId}`}
          >
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5">{entry.trackingId}</code>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-sm font-medium truncate">{entry.subject}</div>
            <div className="mt-0.5 text-xs text-muted-foreground capitalize">
              {entry.category} · {entry.severity} severity
              {entry.photo ? " · photo attached" : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SeverityPillsProps {
  value: FeedbackSeverity;
  onChange: (next: FeedbackSeverity) => void;
  disabled?: boolean;
}

function SeverityPills({ value, onChange, disabled }: SeverityPillsProps) {
  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="radiogroup"
      aria-label="Severity"
      data-testid="group-feedback-severity"
    >
      {SEVERITY_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            data-active={active}
            data-testid={`pill-feedback-severity-${opt.value}`}
            className={cn(
              "h-9 rounded-md text-sm font-medium ring-1 ring-inset transition-colors",
              "ring-border bg-muted/30 text-muted-foreground",
              "hover:bg-muted/60 hover:text-foreground",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              opt.tone,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface PhotoFieldProps {
  photo: FeedbackPhotoMeta | null | undefined;
  onChange: (next: FeedbackPhotoMeta | null) => void;
  disabled?: boolean;
  onError: (message: string) => void;
}

function PhotoField({ photo, onChange, disabled, onError }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    // The component is intentionally thin here — it grabs bytes off
    // disk and hands the metadata to the application-layer policy.
    // Size/MIME/preview-URL rules live in
    // `validatePhotoForFeedback`, not here.
    let previewUrl = "";
    try {
      previewUrl = await readFileAsDataUrl(file);
    } catch {
      // Pass through to the validator so the user-facing copy comes
      // from one place.
    }
    const result = validatePhotoForFeedback({
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      previewUrl,
    });
    if (!result.ok) {
      onError(result.message);
      return;
    }
    onChange(result.photo);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="fb-photo">Photo (optional)</Label>
      <input
        ref={inputRef}
        id="fb-photo"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          void handleFiles(e.target.files);
          // Reset so picking the same file twice re-fires onChange.
          e.target.value = "";
        }}
        data-testid="input-feedback-photo"
      />
      {photo ? (
        <div
          className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
          data-testid="preview-feedback-photo"
        >
          <img
            src={photo.previewUrl}
            alt={photo.name}
            className="h-16 w-16 rounded-md object-cover ring-1 ring-border"
            data-testid="img-feedback-photo-thumb"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium" data-testid="text-feedback-photo-name">
              {photo.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {(photo.sizeBytes / 1024).toFixed(0)} KB
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(null)}
            data-testid="button-feedback-photo-remove"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition-colors",
            "hover:bg-muted/40 hover:text-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          data-testid="button-feedback-photo-pick"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-xs font-medium">Add Photo</span>
          <span className="text-[10px]">JPEG / PNG · up to 5 MB</span>
        </button>
      )}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Camera className="h-3 w-3" />
        Stored on this device for the pilot — not uploaded to a server yet.
      </p>
    </div>
  );
}

export default function FeedbackPage() {
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<FeedbackValidationError[]>([]);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [history, setHistory] = useState<FeedbackOutboxEntry[]>(() =>
    listSessionFeedback(),
  );

  useEffect(() => {
    if (state.kind === "idle" || state.kind === "success") {
      setHistory(listSessionFeedback());
    }
  }, [state.kind]);

  function update<K extends keyof FeedbackDraft>(key: K, value: FeedbackDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors.length > 0) {
      setFieldErrors((prev) => prev.filter((e) => e.field !== key));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "submitting" });
    setFieldErrors([]);
    try {
      const result = await submitFeedback(draft);
      if (!result.ok) {
        setFieldErrors(result.errors);
        setState({ kind: "idle" });
        return;
      }
      setState({
        kind: "success",
        trackingId: result.trackingId,
        pendingBackend: result.pendingBackend,
      });
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Submission failed. Please retry.",
      });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl" data-testid="page-feedback">
        <div className="flex justify-end mb-3">
          <SwitchPortalButton />
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Issue submitted</CardTitle>
            <CardDescription>
              We&rsquo;ve received your report and will take action. Reference&nbsp;
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-xs"
                data-testid="text-feedback-tracking-id"
              >
                {state.trackingId}
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.pendingBackend && (
              <div
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                data-testid="banner-feedback-pending-backend"
              >
                Saved locally for this session. Server-side delivery is wired up in
                the next pilot update — this reference will be honoured when it ships.
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setState({ kind: "idle" })}
                data-testid="button-feedback-submit-another"
              >
                Submit another
              </Button>
              <Link href="/dashboard" className="flex-1">
                <Button className="w-full" data-testid="button-feedback-go-dashboard">
                  Back to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubmitting = state.kind === "submitting";

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl" data-testid="page-feedback">
      <div className="flex justify-end mb-3">
        <SwitchPortalButton />
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Flag className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Report an Issue</CardTitle>
          <CardDescription>
            Report a malfunction, suggest an improvement, or flag a concern.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.kind === "error" && (
            <div
              className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
              data-testid="banner-feedback-error"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="fb-category">Issue Type</Label>
              <select
                id="fb-category"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.category}
                onChange={(e) => update("category", e.target.value as FeedbackCategory)}
                disabled={isSubmitting}
                data-testid="select-feedback-category"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <SeverityPills
                value={draft.severity}
                onChange={(v) => update("severity", v)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-location">Location</Label>
              <select
                id="fb-location"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.location}
                onChange={(e) => update("location", e.target.value as FeedbackLocation)}
                disabled={isSubmitting}
                data-testid="select-feedback-location"
              >
                {FEEDBACK_LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errorFor(fieldErrors, "location") && (
                <p className="text-xs text-destructive" data-testid="error-feedback-location">
                  {errorFor(fieldErrors, "location")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-subject">Subject</Label>
              <Input
                id="fb-subject"
                value={draft.subject}
                onChange={(e) => update("subject", e.target.value)}
                placeholder="Short summary"
                maxLength={120}
                disabled={isSubmitting}
                data-testid="input-feedback-subject"
              />
              {errorFor(fieldErrors, "subject") && (
                <p className="text-xs text-destructive" data-testid="error-feedback-subject">
                  {errorFor(fieldErrors, "subject")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-description">Description</Label>
              <Textarea
                id="fb-description"
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What happened? What were you trying to do?"
                rows={5}
                maxLength={2000}
                disabled={isSubmitting}
                data-testid="textarea-feedback-description"
              />
              {errorFor(fieldErrors, "description") && (
                <p className="text-xs text-destructive" data-testid="error-feedback-description">
                  {errorFor(fieldErrors, "description")}
                </p>
              )}
            </div>

            <PhotoField
              photo={draft.photo}
              onChange={(next) => update("photo", next)}
              disabled={isSubmitting}
              onError={(message) =>
                setFieldErrors((prev) => [
                  ...prev.filter((e) => e.field !== "photo"),
                  { field: "photo", message },
                ])
              }
            />
            {errorFor(fieldErrors, "photo") && (
              <p className="text-xs text-destructive" data-testid="error-feedback-photo">
                {errorFor(fieldErrors, "photo")}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              data-testid="button-feedback-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit Report
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <FeedbackHistory entries={history} />
    </div>
  );
}
