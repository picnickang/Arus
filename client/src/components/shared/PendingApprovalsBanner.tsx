import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bot, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface DraftSummary {
  id: string;
  status: string;
  title?: string;
  draftType?: string;
}

export function PendingApprovalsBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data: drafts } = useQuery<DraftSummary[]>({
    queryKey: ["/api/agent/drafts"],
    refetchInterval: 30000,
  });

  const pendingDrafts = (drafts || []).filter((d) => d.status === "pending");
  const count = pendingDrafts.length;

  if (count === 0 || dismissed) {return null;}

  return (
    <div
      className="mx-4 lg:mx-6 mt-3 mb-1 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3"
      role="alert"
      data-testid="pending-approvals-banner"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            AI Copilot: {count} item{count > 1 ? "s" : ""} awaiting approval
          </div>
          {count <= 3 && (
            <div className="text-xs text-muted-foreground truncate">
              {pendingDrafts.map((d) => d.title || d.draftType || "Draft").join(", ")}
            </div>
          )}
        </div>
      </div>

      <Link href="/findings?source=draft&status=pending">
        <Button size="sm" className="shrink-0 gap-1" data-testid="banner-review-link">
          Review <ChevronRight className="h-3 w-3" />
        </Button>
      </Link>

      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-primary/10 shrink-0"
        aria-label="Dismiss"
        data-testid="banner-dismiss"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
