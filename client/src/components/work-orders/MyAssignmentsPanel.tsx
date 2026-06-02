import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Check, X, Wrench, ShipWheel } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AssignmentWorkOrder {
  id: string;
  title?: string | null;
  reason?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: number | null;
  assignmentStatus?: string | null;
  assignmentResponseReason?: string | null;
  equipmentName?: string | null;
  vesselName?: string | null;
  plannedEndDate?: string | null;
}

const ASSIGNMENTS_QUERY_KEY = ["/api/work-orders/my-assignments"] as const;

function assignmentLabel(wo: AssignmentWorkOrder): string {
  return wo.title || wo.reason || wo.description || "Work order";
}

export function MyAssignmentsPanel() {
  const { toast } = useToast();
  const [declineTarget, setDeclineTarget] = useState<AssignmentWorkOrder | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const { data: assignments = [], isLoading } = useQuery<AssignmentWorkOrder[]>({
    queryKey: ASSIGNMENTS_QUERY_KEY,
    refetchInterval: 60000,
  });

  const respond = useMutation({
    mutationFn: async (vars: {
      workOrderId: string;
      response: "accept" | "decline";
      reason?: string;
    }) => {
      return apiRequest(
        "POST",
        `/api/work-orders/${vars.workOrderId}/assignment-response`,
        { response: vars.response, reason: vars.reason }
      );
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/tasks"] });
      toast({
        title: vars.response === "accept" ? "Assignment accepted" : "Assignment declined",
        description:
          vars.response === "accept"
            ? "The work order is now in progress."
            : "The work order has been sent back for reassignment.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Could not record your response",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const pending = assignments.filter((wo) => wo.assignmentStatus === "assigned");
  const accepted = assignments.filter((wo) => wo.assignmentStatus === "accepted");

  // Hide the panel entirely when there is nothing assigned to this user.
  if (!isLoading && assignments.length === 0) {
    return null;
  }

  const submitDecline = () => {
    if (!declineTarget) {
      return;
    }
    const reason = declineReason.trim();
    if (!reason) {
      return;
    }
    respond.mutate(
      { workOrderId: declineTarget.id, response: "decline", reason },
      {
        onSuccess: () => {
          setDeclineTarget(null);
          setDeclineReason("");
        },
      }
    );
  };

  return (
    <div className="ops-card mb-4 p-4" data-testid="card-my-assignments">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ClipboardCheck className="h-3.5 w-3.5" /> Work Assigned To Me
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="space-y-2">
          {pending.map((wo) => (
            <div
              key={wo.id}
              className="rounded-lg border border-border/60 bg-background/30 p-3"
              data-testid={`row-assignment-${wo.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" data-testid={`text-assignment-title-${wo.id}`}>
                    {assignmentLabel(wo)}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {wo.equipmentName && (
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" /> {wo.equipmentName}
                      </span>
                    )}
                    {wo.vesselName && (
                      <span className="flex items-center gap-1">
                        <ShipWheel className="h-3 w-3" /> {wo.vesselName}
                      </span>
                    )}
                    {wo.plannedEndDate && (
                      <span>Due {new Date(wo.plannedEndDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                  Awaiting response
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => respond.mutate({ workOrderId: wo.id, response: "accept" })}
                  disabled={respond.isPending}
                  data-testid={`button-accept-assignment-${wo.id}`}
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDeclineTarget(wo);
                    setDeclineReason("");
                  }}
                  disabled={respond.isPending}
                  data-testid={`button-decline-assignment-${wo.id}`}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Decline
                </Button>
              </div>
            </div>
          ))}

          {accepted.map((wo) => (
            <div
              key={wo.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/30 p-3"
              data-testid={`row-assignment-${wo.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{assignmentLabel(wo)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {wo.equipmentName || "Equipment"}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-600"
                )}
                data-testid={`badge-assignment-accepted-${wo.id}`}
              >
                Accepted
              </span>
            </div>
          ))}

          {pending.length === 0 && accepted.length === 0 && (
            <div className="text-sm text-muted-foreground" data-testid="empty-my-assignments">
              No assignments need your response right now.
            </div>
          )}
        </div>
      )}

      <Dialog
        open={declineTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineTarget(null);
            setDeclineReason("");
          }
        }}
      >
        <DialogContent data-testid="dialog-decline-assignment">
          <DialogHeader>
            <DialogTitle>Decline assignment</DialogTitle>
            <DialogDescription>
              Let your supervisor know why you can't take this work so it can be reassigned.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Reason for declining (required)"
            maxLength={1000}
            data-testid="input-decline-reason"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeclineTarget(null);
                setDeclineReason("");
              }}
              data-testid="button-cancel-decline"
            >
              Cancel
            </Button>
            <Button
              onClick={submitDecline}
              disabled={respond.isPending || declineReason.trim().length === 0}
              data-testid="button-confirm-decline"
            >
              Submit decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
