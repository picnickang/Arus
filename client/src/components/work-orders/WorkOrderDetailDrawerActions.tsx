import { Copy, Link2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkOrder } from "@shared/schema";

interface WorkOrderDrawerActionsProps {
  workOrder: WorkOrder;
  onClose: () => void;
  onEdit: (workOrder: WorkOrder) => void;
  onClone: ((workOrder: WorkOrder) => void) | undefined;
  onDelete: ((workOrder: WorkOrder) => void) | undefined;
  onLinkTemplate: () => void;
  onCloseout: () => void;
  isCompleting: boolean;
}

export function WorkOrderDrawerActions({
  workOrder,
  onClose,
  onEdit,
  onClone,
  onDelete,
  onLinkTemplate,
  onCloseout,
  isCompleting,
}: WorkOrderDrawerActionsProps) {
  const canCloseOut = workOrder.status !== "completed" && workOrder.status !== "cancelled";

  return (
    <div className="border-t px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-background flex-shrink-0">
      <Button
        variant="outline"
        onClick={onClose}
        data-testid="button-close-wo-drawer"
        className="order-last sm:order-first"
      >
        Close
      </Button>
      <div className="flex flex-wrap gap-2 justify-end">
        {canCloseOut && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLinkTemplate}
            data-testid="button-link-template-drawer"
            className="text-xs sm:text-sm"
          >
            <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden xs:inline">Link </span>Template
          </Button>
        )}
        {onClone && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onClone(workOrder)}
            data-testid="button-clone-wo-drawer"
            className="text-xs sm:text-sm"
          >
            <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
            Clone
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(workOrder)}
          data-testid="button-edit-wo-drawer"
          className="text-xs sm:text-sm"
        >
          Edit
        </Button>
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              onDelete(workOrder);
            }}
            data-testid="button-delete-wo-drawer"
            className="text-xs sm:text-sm text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
            Delete
          </Button>
        )}
        {canCloseOut && (
          <Button
            size="sm"
            onClick={onCloseout}
            disabled={isCompleting}
            data-testid="button-complete-wo-drawer"
            className="text-xs sm:text-sm"
          >
            {isCompleting ? "Closing..." : "Closeout"}
          </Button>
        )}
      </div>
    </div>
  );
}
