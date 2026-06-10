import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Wrench, FileText, Check, UserPlus, BellOff } from "lucide-react";
import { AssignmentStatusBadge } from "@/components/work-orders";
import type { EquipmentHubData, EquipmentHubCrewMember } from "@/hooks/useEquipmentHub";

/** Sticky action bar — always rendered above the tabs so the pinned
 * Playwright testids stay reachable on page load. */
export function ActionBar({
  data,
  crew,
  isCrewLoading,
  acknowledgeAnomaly,
  isAcknowledgePending,
  assignWork,
  isAssignPending,
  onQuickWo,
  navigate,
}: {
  data: EquipmentHubData;
  crew: EquipmentHubCrewMember[];
  isCrewLoading: boolean;
  acknowledgeAnomaly: () => void;
  isAcknowledgePending: boolean;
  assignWork: (args: { workOrderId: string; crewId: string }) => void;
  isAssignPending: boolean;
  onQuickWo: () => void;
  navigate: (to: string) => void;
}) {
  const assignableWorkOrder = data.workOrders.find(
    (wo) => wo.status === "open" || wo.status === "pending" || wo.status === "in_progress"
  );
  const anomaly = data.activeAnomaly;
  const canAcknowledge = !!anomaly && !anomaly.acknowledged;
  return (
    <div
      className="flex items-center gap-2 flex-wrap sticky top-0 z-10 py-2 bg-[#080e1a]/95 backdrop-blur-sm -mx-4 px-4 md:-mx-6 md:px-6"
      data-testid="action-bar"
    >
      <Button
        size="sm"
        className="text-xs bg-sky-500 text-white hover:bg-sky-400"
        onClick={onQuickWo}
        data-testid="button-quick-work-order"
      >
        <Wrench className="h-3.5 w-3.5 mr-1.5" />
        Quick Work Order
      </Button>

      <Button
        size="sm"
        className="text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 hover:bg-sky-500/25"
        onClick={() => navigate(`/work-orders?action=create&equipmentId=${data.id}`)}
        data-testid="button-create-work-order"
      >
        <FileText className="h-3.5 w-3.5 mr-1.5" />
        Full Form
      </Button>

      {anomaly && anomaly.acknowledged ? (
        <Button
          size="sm"
          variant="outline"
          className="text-xs text-emerald-400 border-emerald-500/25"
          disabled
          data-testid="button-acknowledge"
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Acknowledged
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => acknowledgeAnomaly()}
          disabled={!canAcknowledge || isAcknowledgePending}
          title={
            canAcknowledge ? "Acknowledge the active anomaly" : "No active anomaly to acknowledge"
          }
          data-testid="button-acknowledge"
        >
          {isAcknowledgePending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <BellOff className="h-3.5 w-3.5 mr-1.5" />
          )}
          Acknowledge
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            disabled={isAssignPending}
            data-testid="button-assign"
          >
            {isAssignPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            )}
            Assign
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">
            {assignableWorkOrder ? `Assign "${assignableWorkOrder.title}" to` : "Assign work to"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!assignableWorkOrder ? (
            <DropdownMenuItem
              onClick={() => navigate(`/work-orders?action=create&equipmentId=${data.id}`)}
              data-testid="assign-no-work-order"
            >
              <FileText className="h-3.5 w-3.5 mr-2" />
              No open work order — create one
            </DropdownMenuItem>
          ) : isCrewLoading ? (
            <DropdownMenuItem disabled>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Loading crew...
            </DropdownMenuItem>
          ) : crew.length === 0 ? (
            <DropdownMenuItem onClick={() => navigate("/crew")} data-testid="assign-no-crew">
              No crew available — manage crew
            </DropdownMenuItem>
          ) : (
            crew.map((member) => (
              <DropdownMenuItem
                key={member.id}
                onClick={() =>
                  assignWork({ workOrderId: assignableWorkOrder.id, crewId: member.id })
                }
                data-testid={`assign-crew-${member.id}`}
              >
                <UserPlus className="h-3.5 w-3.5 mr-2" />
                <span className="truncate">
                  {member.name}
                  {member.rank ? ` · ${member.rank}` : ""}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {assignableWorkOrder && (
        <AssignmentStatusBadge
          status={assignableWorkOrder.assignmentStatus}
          assignedTo={assignableWorkOrder.assignedCrewId}
          testId={`badge-assignable-status-${assignableWorkOrder.id}`}
        />
      )}
    </div>
  );
}
