/**
 * Feedback Review — office triage queue for crew-submitted reports.
 *
 * Admin-portal-only surface (gated in App.tsx ADMIN_ONLY_ROUTES and by
 * requireRole on /api/feedback-review). Staff acknowledge incoming
 * reports, resolve them with a note, and link the work order raised
 * from a report. The crew-side page (`/feedback`) shows the resulting
 * status/work-order chips to the submitter.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StatusChip } from "./feedback/StatusChip";
import { ResolveDialog } from "./feedback-review/ResolveDialog";
import {
  REVIEW_FILTERS,
  type ReviewEntry,
  type ReviewFilter,
} from "./feedback-review/review-types";

const FILTER_LABELS: Record<ReviewFilter, string> = {
  all: "All",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

const SEVERITY_TONES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/15 text-amber-600",
  high: "bg-red-500/15 text-red-600",
};

function formatSubmittedAt(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDate(date, { hour: "2-digit", minute: "2-digit" });
}

export default function FeedbackReviewPage() {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [resolving, setResolving] = useState<ReviewEntry | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queue = useQuery<ReviewEntry[]>({
    queryKey: ["/api/feedback-review"],
    staleTime: 30_000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/feedback-review/${id}`, { status: "acknowledged" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback-review"] });
      toast({ title: "Report acknowledged" });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not acknowledge report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const entries = queue.data ?? [];
  const counts = REVIEW_FILTERS.reduce<Record<ReviewFilter, number>>(
    (acc, key) => {
      acc[key] = key === "all" ? entries.length : entries.filter((e) => e.status === key).length;
      return acc;
    },
    { all: 0, submitted: 0, acknowledged: 0, resolved: 0 }
  );
  const visible = filter === "all" ? entries : entries.filter((e) => e.status === filter);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="page-feedback-review">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback Review
          </CardTitle>
          <CardDescription>
            Crew reports across the fleet — acknowledge incoming reports, resolve them with a note,
            and link the work order raised from a report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {REVIEW_FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover-elevate"
                )}
                data-testid={`pill-feedback-filter-${key}`}
              >
                {FILTER_LABELS[key]} ({counts[key]})
              </button>
            ))}
          </div>

          {queue.isLoading && (
            <div
              className="flex items-center gap-2 py-8 justify-center text-muted-foreground"
              data-testid="loading-feedback-review"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading reports…
            </div>
          )}

          {queue.isError && (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="error-feedback-review"
            >
              Could not load the review queue. {queue.error?.message ?? ""}
            </div>
          )}

          {!queue.isLoading && !queue.isError && visible.length === 0 && (
            <div
              className="flex flex-col items-center gap-2 py-10 text-muted-foreground"
              data-testid="empty-feedback-review"
            >
              <Inbox className="h-8 w-8" />
              <p className="text-sm">No {filter === "all" ? "" : `${filter} `}reports.</p>
            </div>
          )}

          <ul className="space-y-3">
            {visible.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-border p-4 space-y-2"
                data-testid={`card-feedback-review-${entry.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {entry.category}
                    </Badge>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                        SEVERITY_TONES[entry.severity] ?? SEVERITY_TONES["low"]
                      )}
                    >
                      {entry.severity}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {entry.location.replace(/_/g, " ")}
                    </span>
                  </div>
                  <StatusChip
                    entry={{ ...entry, createdAt: entry.createdAt ?? "", pending: false }}
                  />
                </div>
                <p className="font-medium text-sm">{entry.subject}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {entry.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.trackingId} · {entry.submitterName ?? entry.userId} ·{" "}
                  {formatSubmittedAt(entry.createdAt)}
                </p>
                {entry.status === "resolved" && entry.resolutionNote && (
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {entry.resolutionNote}
                  </p>
                )}
                {entry.status !== "resolved" && (
                  <div className="flex gap-2 pt-1">
                    {entry.status === "submitted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate(entry.id)}
                        disabled={acknowledgeMutation.isPending}
                        data-testid={`button-ack-${entry.id}`}
                      >
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setResolving(entry)}
                      data-testid={`button-resolve-${entry.id}`}
                    >
                      Resolve…
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ResolveDialog entry={resolving} onOpenChange={(open) => !open && setResolving(null)} />
    </div>
  );
}
