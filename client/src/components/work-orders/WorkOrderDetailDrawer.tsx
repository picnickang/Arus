import { useState as useLocalState } from "react";
import { Wrench } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkOrderDetailData } from "@/features/work-orders";
import type { WorkOrder } from "@shared/schema";
import { LinkTemplateDialog } from "./LinkTemplateDialog";
import {
  WorkOrderCloseoutWizard,
  type CloseoutPredictionFeedback,
} from "./WorkOrderCloseoutWizard";
import {
  getEquipmentName,
  getEquipmentType,
  WorkOrderDetailTabs,
  WorkOrderHeaderBadges,
  type WorkOrderDetailCrewItem,
  type WorkOrderDetailEquipmentItem,
  type WorkOrderDetailVesselItem,
} from "./WorkOrderDetailDrawerParts";
import { WorkOrderDrawerActions } from "./WorkOrderDetailDrawerActions";

interface WorkOrderDetailDrawerProps {
  workOrder: WorkOrder | null;
  open: boolean;
  onClose: () => void;
  equipment: WorkOrderDetailEquipmentItem[];
  vessels: WorkOrderDetailVesselItem[];
  crew: WorkOrderDetailCrewItem[];
  onComplete: (
    workOrderId: string,
    feedback?: {
      workOrderId: string;
      predictionId?: string | number | null;
      outcome: "confirmed" | "partial" | "false_alarm";
      notes?: string;
    }
  ) => void;
  onEdit: (workOrder: WorkOrder) => void;
  onClone?: (workOrder: WorkOrder) => void;
  onDelete?: (workOrder: WorkOrder) => void;
  isCompleting?: boolean;
}

export function WorkOrderDetailDrawer({
  workOrder,
  open,
  onClose,
  equipment,
  vessels,
  crew,
  onComplete,
  onEdit,
  onClone,
  onDelete,
  isCompleting = false,
}: WorkOrderDetailDrawerProps) {
  const {
    activeTab,
    setActiveTab,
    linkTemplateDialogOpen,
    setLinkTemplateDialogOpen,
    workOrderParts,
    totalPartsCost,
    totalLaborCost,
    totalProcurementCost,
    downtimeCost,
    procurementCosts,
    grandTotal,
    invalidateParts,
    invalidateChecklist,
  } = useWorkOrderDetailData({ workOrder });
  const [closeoutOpen, setCloseoutOpen] = useLocalState(false);

  if (!workOrder) {
    return null;
  }

  const isPredictiveWo = workOrder.maintenanceType === "predictive";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:w-[540px] lg:w-[640px] p-0 flex flex-col h-dvh max-h-dvh overflow-hidden"
      >
        <SheetHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2 truncate">
                <Wrench className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">{workOrder.woNumber || workOrder.id.slice(0, 8)}</span>
              </SheetTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                {getEquipmentName(equipment, workOrder.equipmentId)}
              </p>
            </div>
            <WorkOrderHeaderBadges workOrder={workOrder} />
          </div>
        </SheetHeader>

        <WorkOrderDetailTabs
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          workOrder={workOrder}
          equipment={equipment}
          vessels={vessels}
          crew={crew}
          workOrderParts={workOrderParts}
          totalPartsCost={totalPartsCost}
          totalLaborCost={totalLaborCost}
          totalProcurementCost={totalProcurementCost}
          downtimeCost={downtimeCost}
          procurementCosts={procurementCosts}
          grandTotal={grandTotal}
          invalidateParts={invalidateParts}
        />

        <WorkOrderDrawerActions
          workOrder={workOrder}
          onClose={onClose}
          onEdit={onEdit}
          onClone={onClone}
          onDelete={onDelete}
          onLinkTemplate={() => setLinkTemplateDialogOpen(true)}
          onCloseout={() => setCloseoutOpen(true)}
          isCompleting={isCompleting}
        />

        <WorkOrderCloseoutWizard
          open={closeoutOpen}
          onOpenChange={setCloseoutOpen}
          workOrderId={workOrder.id}
          isPredictive={isPredictiveWo}
          isSubmitting={isCompleting}
          onComplete={(feedback?: CloseoutPredictionFeedback) => {
            onComplete(workOrder.id, feedback);
            setCloseoutOpen(false);
          }}
        />

        <LinkTemplateDialog
          workOrderId={workOrder.id}
          equipmentType={getEquipmentType(equipment, workOrder.equipmentId)}
          open={linkTemplateDialogOpen}
          onOpenChange={setLinkTemplateDialogOpen}
          onSuccess={invalidateChecklist}
        />
      </SheetContent>
    </Sheet>
  );
}
