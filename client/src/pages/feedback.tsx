/**
 * Feedback / Flags — pilot form.
 *
 * Surfaced as the second item in the simplified user-portal nav. The
 * page owns rendering only; validation + dispatch live in
 * `client/src/application/feedback/feedback-submission.ts`.
 *
 * States rendered: idle, validating, submitting, success, error.
 */

import { useState, type FormEvent } from "react";
import { Flag, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitFeedback,
  type FeedbackCategory,
  type FeedbackDraft,
  type FeedbackSeverity,
  type FeedbackValidationError,
} from "@/application/feedback/feedback-submission";

const EMPTY_DRAFT: FeedbackDraft = {
  category: "suggestion",
  severity: "low",
  subject: "",
  description: "",
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; trackingId: string; pendingBackend: boolean }
  | { kind: "error"; message: string };

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "suggestion", label: "Suggestion" },
  { value: "bug", label: "Bug" },
  { value: "flag", label: "Flag a concern" },
];

const SEVERITY_OPTIONS: Array<{ value: FeedbackSeverity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function errorFor(
  errors: FeedbackValidationError[],
  field: keyof FeedbackDraft,
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export default function FeedbackPage() {
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<FeedbackValidationError[]>([]);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

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
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Thanks — your feedback was captured</CardTitle>
            <CardDescription>
              Reference&nbsp;
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
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Flag className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Feedback &amp; Flags</CardTitle>
          <CardDescription>
            Report an issue, suggest an improvement, or flag a concern.
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

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fb-category">Category</Label>
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
                <Label htmlFor="fb-severity">Severity</Label>
                <select
                  id="fb-severity"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.severity}
                  onChange={(e) => update("severity", e.target.value as FeedbackSeverity)}
                  disabled={isSubmitting}
                  data-testid="select-feedback-severity"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
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
                  Submit feedback
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
