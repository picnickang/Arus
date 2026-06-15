import type { ComponentType } from "react";
import {
  User,
  Ship,
  Wrench,
  Calendar,
  DollarSign,
  FileText,
  Package,
  ClipboardList,
  History,
  Send,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

import { AssignmentStatusBadge } from "./AssignmentStatusBadge";
import { LinkedServiceOrdersPanel } from "./LinkedServiceOrdersPanel";
import { MultiPartSelector } from "@/components/MultiPartSelector";
import { WorkOrderHistoryTab } from "./WorkOrderHistoryTab";
import { WorkOrderRequestsTab } from "./WorkOrderRequestsTab";
import { WorkOrderTasksTab } from "./WorkOrderTasksTab";
import { CostBreakdown, TimeTracking } from "./WorkOrderDetailCostTime";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProcurementCosts, UseWorkOrderDetailDataReturn } from "@/features/work-orders";
import { cn } from "@/lib/utils";
import type { WorkOrder } from "@shared/schema";
import {
  DEFAULT_PRIORITY_CONFIG,
  DEFAULT_STATUS_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
} from "./work-order-badge-config";

export interface WorkOrderDetailEquipmentItem {
  id: string;
  name: string;
  type?: string;
}

export interface WorkOrderDetailVesselItem {
  id: string;
  name: string;
}

export interface WorkOrderDetailCrewItem {
  id: string;
  name: string;
  hourlyRate?: number;
  rank?: string;
}

export function getEquipmentName(
  equipment: WorkOrderDetailEquipmentItem[],
  equipmentId: string
): string {
  return (
    equipment.find((item) => item.id === equipmentId)?.name || equipmentId?.slice(0, 8) || "Unknown"
  );
}

export function getEquipmentType(
  equipment: WorkOrderDetailEquipmentItem[],
  equipmentId: string
): string {
  return equipment.find((item) => item.id === equipmentId)?.type || "Equipment";
}

function getVesselName(vessels: WorkOrderDetailVesselItem[], vesselId: string | null): string {
  return !vesselId
    ? "Not assigned"
    : vessels.find((vessel) => vessel.id === vesselId)?.name || vesselId.slice(0, 8);
}

function getCrewName(crew: WorkOrderDetailCrewItem[], crewId: string | null): string {
  return !crewId
    ? "Unassigned"
    : crew.find((member) => member.id === crewId)?.name || crewId.slice(0, 8);
}

function getCrewHourlyRate(crew: WorkOrderDetailCrewItem[], crewId: string | null): number | null {
  return !crewId ? null : crew.find((member) => member.id === crewId)?.hourlyRate || null;
}

function InfoCard({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: ComponentType<{ className?: string | undefined }>;
  label: string;
  value: string;
  subValue?: string | undefined;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div>
        <span className="text-xs text-muted-foreground block">{label}</span>
        <span className="text-sm font-medium">{value}</span>
        {subValue && <span className="text-xs text-muted-foreground block">{subValue}</span>}
      </div>
    </div>
  );
}

export function WorkOrderHeaderBadges({ workOrder }: { workOrder: WorkOrder }) {
  const statusConfig = STATUS_CONFIG[workOrder.status] || DEFAULT_STATUS_CONFIG;
  const priorityConfig = PRIORITY_CONFIG[workOrder.priority] || DEFAULT_PRIORITY_CONFIG;

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Badge className={cn("text-xs", priorityConfig.className)}>{priorityConfig.label}</Badge>
      <Badge className={cn("text-xs", statusConfig.className)}>{statusConfig.label}</Badge>
    </div>
  );
}

interface WorkOrderDetailTabsProps {
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  workOrder: WorkOrder;
  equipment: WorkOrderDetailEquipmentItem[];
  vessels: WorkOrderDetailVesselItem[];
  crew: WorkOrderDetailCrewItem[];
  workOrderParts: UseWorkOrderDetailDataReturn["workOrderParts"];
  totalPartsCost: number;
  totalLaborCost: number;
  totalProcurementCost: number;
  downtimeCost: number;
  procurementCosts: ProcurementCosts | null;
  grandTotal: number;
  invalidateParts: () => void;
}

export function WorkOrderDetailTabs({
  activeTab,
  onActiveTabChange,
  workOrder,
  equipment,
  vessels,
  crew,
  workOrderParts,
  totalPartsCost,
  totalLaborCost,
  totalProcurementCost,
  downtimeCost,
  procurementCosts,
  grandTotal,
  invalidateParts,
}: WorkOrderDetailTabsProps) {
  const assignedCrewRate = getCrewHourlyRate(crew, workOrder.assignedCrewId);
  const calculatedLaborCost =
    assignedCrewRate && workOrder.laborHours ? assignedCrewRate * workOrder.laborHours : null;

  return (
    <Tabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <TabsList className="w-full justify-start rounded-none border-b px-2 sm:px-6 h-auto py-0 flex-shrink-0 overflow-x-auto">
        <TabsTrigger
          value="details"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4"
          data-testid="tab-wo-details"
        >
          <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
          Details
        </TabsTrigger>
        <TabsTrigger
          value="parts"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4"
          data-testid="tab-wo-parts"
        >
          <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
          Parts ({workOrderParts.length})
        </TabsTrigger>
        <TabsTrigger
          value="requests"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4"
          data-testid="tab-wo-requests"
        >
          <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
          Requests
        </TabsTrigger>
        <TabsTrigger
          value="tasks"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4"
          data-testid="tab-wo-tasks"
        >
          <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
          Tasks
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4"
          data-testid="tab-wo-history"
        >
          <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
          History
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto min-h-0">
        <TabsContent value="details" className="mt-0 p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <InfoCard
              icon={Ship}
              label="Vessel"
              value={getVesselName(vessels, workOrder.vesselId)}
            />
            <InfoCard
              icon={Wrench}
              label="Equipment"
              value={getEquipmentName(equipment, workOrder.equipmentId)}
              subValue={getEquipmentType(equipment, workOrder.equipmentId)}
            />
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground block">Assigned To</span>
                <span className="text-sm font-medium">
                  {getCrewName(crew, workOrder.assignedCrewId)}
                </span>
                {assignedCrewRate && (
                  <span className="text-xs text-muted-foreground block">
                    ${assignedCrewRate.toFixed(2)}/hr
                  </span>
                )}
                {workOrder.assignedCrewId && workOrder.assignmentStatus && (
                  <div className="mt-1.5">
                    <AssignmentStatusBadge
                      status={workOrder.assignmentStatus}
                      assignedTo={workOrder.assignedCrewId}
                      testId={`badge-assignment-status-${workOrder.id}`}
                    />
                    {workOrder.assignmentStatus === "declined" &&
                      workOrder.assignmentResponseReason && (
                        <p
                          className="mt-1 text-xs text-muted-foreground"
                          data-testid={`text-assignment-decline-reason-${workOrder.id}`}
                        >
                          Reason: {workOrder.assignmentResponseReason}
                        </p>
                      )}
                    {workOrder.assignmentRespondedAt && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {workOrder.assignmentStatus === "declined" ? "Declined " : "Responded "}
                        {formatDistanceToNow(new Date(workOrder.assignmentRespondedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <InfoCard
              icon={Calendar}
              label="Due Date"
              value={
                workOrder.plannedEndDate
                  ? format(new Date(workOrder.plannedEndDate), "MMM d, yyyy")
                  : "Not set"
              }
            />
          </div>
          <Separator />
          <div>
            <h4 className="font-medium mb-2">Reason</h4>
            <p className="text-sm text-muted-foreground">
              {workOrder.reason || "No reason provided"}
            </p>
          </div>
          {workOrder.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {workOrder.description}
              </p>
            </div>
          )}
          {workOrder.costJustification && (
            <div data-testid="cost-justification-section">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-600" />
                Cost Justification
              </h4>
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-md p-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {workOrder.costJustification}
                </p>
              </div>
            </div>
          )}
          <Separator />
          <CostBreakdown
            workOrder={workOrder}
            totalPartsCost={totalPartsCost}
            totalLaborCost={totalLaborCost}
            totalProcurementCost={totalProcurementCost}
            downtimeCost={downtimeCost}
            procurementCosts={procurementCosts}
            grandTotal={grandTotal}
            assignedCrewRate={assignedCrewRate}
            calculatedLaborCost={calculatedLaborCost}
          />
          <Separator />
          <TimeTracking workOrder={workOrder} />
          <Separator />
          <LinkedServiceOrdersPanel
            workOrderId={workOrder.id}
            workOrderNumber={workOrder.woNumber || workOrder.id.slice(0, 8)}
            workOrderStatus={workOrder.status}
          />
        </TabsContent>

        <TabsContent value="parts" className="mt-0 p-4 sm:p-6">
          <MultiPartSelector workOrderId={workOrder.id} onPartsAdded={invalidateParts} />
        </TabsContent>

        <TabsContent value="requests" className="mt-0 p-4 sm:p-6">
          <WorkOrderRequestsTab
            workOrderId={workOrder.id}
            isReadOnly={workOrder.status === "completed" || workOrder.status === "cancelled"}
            requireAdvancedOptions={workOrder.maintenanceType === "drydock"}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-0 p-4 sm:p-6">
          <WorkOrderTasksTab
            workOrderId={workOrder.id}
            isReadOnly={workOrder.status === "completed" || workOrder.status === "cancelled"}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0 p-4 sm:p-6">
          <WorkOrderHistoryTab workOrderId={workOrder.id} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
