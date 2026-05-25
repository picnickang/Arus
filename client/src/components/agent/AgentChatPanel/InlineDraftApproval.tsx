import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftRecord } from "./types";

export function InlineDraftApproval({
  draft,
  onApprove,
  onReject,
  isPending,
}: {
  draft: DraftRecord;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}) {
  const draftData = draft.data || {};
  const estimatedHours = draftData['estimatedHours'] as number | undefined;
  const estimatedCostPerHour = draftData['estimatedCostPerHour'] as number | undefined;
  const estimatedLaborCost = draftData['estimatedLaborCost'] as number | undefined;
  const estimatedPartsCost = draftData['estimatedPartsCost'] as number | undefined;
  const costJustification = draftData['costJustification'] as string | undefined;
  const hasCostInfo =
    estimatedHours != null ||
    estimatedCostPerHour != null ||
    estimatedLaborCost != null ||
    estimatedPartsCost != null ||
    costJustification;

  return (
    <div
      className="mt-2 border border-amber-500/30 bg-amber-500/5 rounded-md p-2.5"
      data-testid={`card-draft-${draft.id}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" data-testid={`text-draft-title-${draft.id}`}>
            {draft.title}
          </p>
          <p
            className="text-[11px] text-muted-foreground mt-0.5"
            data-testid={`text-draft-type-${draft.id}`}
          >
            {draft.draftType === "work_order" ? "Work Order" : draft.draftType} — requires approval
          </p>
          {hasCostInfo && (
            <div
              className="mt-1.5 p-1.5 bg-muted/50 rounded text-[11px] space-y-0.5"
              data-testid={`cost-info-${draft.id}`}
            >
              {(estimatedHours != null ||
                estimatedLaborCost != null ||
                estimatedPartsCost != null) && (
                <div className="space-y-0.5 text-muted-foreground">
                  {(estimatedHours != null || estimatedLaborCost != null) && (
                    <div className="flex items-center gap-2">
                      <span>💰</span>
                      <span>
                        Labor: {estimatedHours != null && `${estimatedHours}h`}
                        {estimatedCostPerHour != null && ` × $${estimatedCostPerHour}/hr`}
                        {estimatedLaborCost != null && ` = $${estimatedLaborCost.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                  {estimatedPartsCost != null && (
                    <div className="flex items-center gap-2">
                      <span>🔧</span>
                      <span>Parts: ~${estimatedPartsCost.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              {costJustification && (
                <p
                  className="text-muted-foreground italic"
                  data-testid={`cost-justification-${draft.id}`}
                >
                  {costJustification}
                </p>
              )}
            </div>
          )}
          {draft.status === "pending" ? (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="default"
                className="h-6 text-[11px] px-2"
                onClick={() => onApprove(draft.id)}
                disabled={isPending}
                data-testid={`button-approve-draft-${draft.id}`}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2"
                onClick={() => onReject(draft.id)}
                disabled={isPending}
                data-testid={`button-reject-draft-${draft.id}`}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          ) : (
            <span
              className={cn(
                "inline-block mt-1.5 text-[11px] px-1.5 py-0.5 rounded",
                draft.status === "approved"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-muted text-muted-foreground"
              )}
              data-testid={`badge-draft-status-${draft.id}`}
            >
              {draft.status === "approved" ? "Approved" : "Rejected"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
