import { cn } from "@/lib/utils";
import type {
  FeedbackOutboxEntry,
  ServerFeedbackEntry,
} from "@/application/feedback/feedback-submission";

export type HistoryEntry =
  | (ServerFeedbackEntry & { pending: false })
  | (FeedbackOutboxEntry & { pending: true });

const STATUS_TONES: Record<string, string> = {
  submitted: "bg-muted text-muted-foreground",
  acknowledged: "bg-amber-500/15 text-amber-600",
  resolved: "bg-emerald-500/15 text-emerald-600",
};

export function StatusChip({ entry }: { entry: HistoryEntry }) {
  if (entry.pending) {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-600">
        Pending sync
      </span>
    );
  }
  const label =
    entry.status === "resolved" && entry.linkedWorkOrderId
      ? `Resolved — ${entry.linkedWorkOrderId}`
      : entry.status;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        STATUS_TONES[entry.status] ?? STATUS_TONES["submitted"]
      )}
    >
      {label}
    </span>
  );
}
