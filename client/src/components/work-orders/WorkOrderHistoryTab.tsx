import { useQuery } from "@tanstack/react-query";
import {
  History,
  AlertCircle,
  CheckCircle2,
  Package,
  ClipboardCheck,
  Edit3,
  UserPlus,
  Flag,
  ArrowRight,
  Clock,
  Loader2,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import type { WorkOrderHistory, InventoryMovement } from "@shared/schema";

interface WorkOrderHistoryTabProps {
  workOrderId: string;
}

interface WorkOrderHistoryResponse {
  history: WorkOrderHistory[];
  inventoryMovements: InventoryMovement[];
}

type LucideIcon = React.ComponentType<{ className?: string }>;
const EVENT_TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  created: { icon: Clock, color: "text-blue-500", label: "Created" },
  status_changed: { icon: ArrowRight, color: "text-purple-500", label: "Status Changed" },
  priority_changed: { icon: Flag, color: "text-orange-500", label: "Priority Changed" },
  assigned: { icon: UserPlus, color: "text-teal-500", label: "Assigned" },
  part_added: { icon: Package, color: "text-green-500", label: "Part Added" },
  part_removed: { icon: Package, color: "text-red-500", label: "Part Removed" },
  task_added: { icon: ClipboardCheck, color: "text-blue-500", label: "Task Added" },
  task_completed: { icon: CheckCircle2, color: "text-green-500", label: "Task Completed" },
  task_deleted: { icon: ClipboardCheck, color: "text-red-500", label: "Task Deleted" },
  edited: { icon: Edit3, color: "text-yellow-500", label: "Edited" },
  completed: { icon: CheckCircle2, color: "text-green-600", label: "Completed" },
};

const MOVEMENT_TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  reserve: { icon: ArrowDown, color: "text-yellow-500", label: "Reserved" },
  release: { icon: ArrowUp, color: "text-blue-500", label: "Released" },
  consume: { icon: Package, color: "text-red-500", label: "Consumed" },
  restock: { icon: ArrowUp, color: "text-green-500", label: "Restocked" },
  adjustment: { icon: Edit3, color: "text-purple-500", label: "Adjusted" },
};

export function WorkOrderHistoryTab({ workOrderId }: WorkOrderHistoryTabProps) {
  const { data, isLoading, error } = useQuery<WorkOrderHistoryResponse>({
    queryKey: ["/api/work-orders", workOrderId, "history"],
    queryFn: () =>
      apiRequest<WorkOrderHistoryResponse>("GET", `/api/work-orders/${workOrderId}/history`),
    enabled: !!workOrderId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">Failed to Load History</h3>
        <p className="text-muted-foreground mt-1">
          Unable to retrieve audit trail. Please try again.
        </p>
      </div>
    );
  }

  const historyEntries: WorkOrderHistory[] = data?.history ?? [];
  const inventoryMovements: InventoryMovement[] = data?.inventoryMovements ?? [];

  const combinedTimeline = [
    ...historyEntries.map((entry) => ({
      type: "history" as const,
      date: entry.createdAt ? new Date(entry.createdAt) : null,
      data: entry,
    })),
    ...inventoryMovements.map((movement) => ({
      type: "inventory" as const,
      date: movement.createdAt ? new Date(movement.createdAt) : null,
      data: movement,
    })),
  ].sort((a, b) => {
    const aTime = a.date?.getTime() ?? 0;
    const bTime = b.date?.getTime() ?? 0;
    return bTime - aTime;
  });

  if (combinedTimeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No History Yet</h3>
        <p className="text-muted-foreground mt-1 max-w-sm">
          Changes to this work order will appear here as an audit trail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Trail
        </h3>
        <Badge variant="secondary" data-testid="badge-history-count">
          {combinedTimeline.length} {combinedTimeline.length === 1 ? "event" : "events"}
        </Badge>
      </div>

      <Separator />

      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

        <div className="space-y-6">
          {combinedTimeline.map((item, index) => (
            <TimelineItem
              key={item.type === "history" ? `h-${item.data.id}` : `i-${item.data.id}`}
              item={item}
              isFirst={index === 0}
              isLast={index === combinedTimeline.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  item,
  isFirst,
  isLast: _isLast,
}: {
  item: {
    type: "history" | "inventory";
    date: Date | null;
    data: WorkOrderHistory | InventoryMovement;
  };
  isFirst: boolean;
  isLast: boolean;
}) {
  if (item.type === "history") {
    return <HistoryTimelineItem entry={item.data as WorkOrderHistory} isFirst={isFirst} />;
  }
  return <InventoryTimelineItem movement={item.data as InventoryMovement} isFirst={isFirst} />;
}

function HistoryTimelineItem({ entry, isFirst }: { entry: WorkOrderHistory; isFirst: boolean }) {
  const config = EVENT_TYPE_CONFIG[entry.eventType] || {
    icon: Edit3,
    color: "text-gray-500",
    label: entry.eventType,
  };
  const Icon = config.icon;

  return (
    <div className="relative flex gap-4 pl-1" data-testid={`timeline-history-${entry.id}`}>
      <div
        className={cn(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background",
          isFirst ? "border-primary" : "border-border"
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>

      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{config.label}</span>
          {entry.previousValue && entry.newValue && (
            <span className="text-xs text-muted-foreground">
              {entry.previousValue} <ArrowRight className="h-3 w-3 inline" /> {entry.newValue}
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>

        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>{entry.performedByName || entry.performedBy}</span>
          <span>•</span>
          <span title={entry.createdAt ? format(new Date(entry.createdAt), "PPpp") : "Unknown"}>
            {entry.createdAt
              ? formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })
              : "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );
}

function InventoryTimelineItem({
  movement,
  isFirst,
}: {
  movement: InventoryMovement;
  isFirst: boolean;
}) {
  const config = MOVEMENT_TYPE_CONFIG[movement.movementType] || {
    icon: Package,
    color: "text-gray-500",
    label: movement.movementType,
  };
  const Icon = config.icon;

  const quantityChange = movement.quantity;
  const isPositive = quantityChange > 0;

  return (
    <div className="relative flex gap-4 pl-1" data-testid={`timeline-inventory-${movement.id}`}>
      <div
        className={cn(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background",
          isFirst ? "border-primary" : "border-border"
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>

      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">Inventory {config.label}</span>
          <Badge variant={isPositive ? "default" : "secondary"} className="text-xs">
            {isPositive ? "+" : ""}
            {quantityChange}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground mt-0.5">
          Stock: {movement.quantityBefore} → {movement.quantityAfter}
          {movement.notes && ` — ${movement.notes}`}
        </p>

        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>{movement.performedBy}</span>
          <span>•</span>
          <span
            title={movement.createdAt ? format(new Date(movement.createdAt), "PPpp") : "Unknown"}
          >
            {movement.createdAt
              ? formatDistanceToNow(new Date(movement.createdAt), { addSuffix: true })
              : "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default WorkOrderHistoryTab;
