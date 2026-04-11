import { useState as useLocalState } from "react";
import { Clock, User, Ship, Wrench, Calendar, DollarSign, FileText, Package, ClipboardList, History, Copy, Link2, Send, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistanceToNow, format } from "date-fns";
import { MultiPartSelector } from "@/components/MultiPartSelector";
import { WorkOrderTasksTab } from "./WorkOrderTasksTab";
import { WorkOrderHistoryTab } from "./WorkOrderHistoryTab";
import { WorkOrderRequestsTab } from "./WorkOrderRequestsTab";
import { LinkTemplateDialog } from "./LinkTemplateDialog";
import { LinkedServiceOrdersPanel } from "./LinkedServiceOrdersPanel";
import { PredictionFeedbackForm } from "./PredictionFeedbackForm";
import { cn } from "@/lib/utils";
import { useWorkOrderDetailData } from "@/features/work-orders";
import type { WorkOrder } from "@shared/schema";

interface EquipmentItem { id: string; name: string; type?: string; }
interface VesselItem { id: string; name: string; }
interface CrewItem { id: string; name: string; hourlyRate?: number; rank?: string; }
interface WorkOrderDetailDrawerProps {
  workOrder: WorkOrder | null;
  open: boolean;
  onClose: () => void;
  equipment: EquipmentItem[];
  vessels: VesselItem[];
  crew: CrewItem[];
  onComplete: (workOrderId: string) => void;
  onEdit: (workOrder: WorkOrder) => void;
  onClone?: (workOrder: WorkOrder) => void;
  onDelete?: (workOrder: WorkOrder) => void;
  isCompleting?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-500/20 text-blue-700 dark:text-blue-300" },
  in_progress: { label: "In Progress", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" },
  completed: { label: "Completed", className: "bg-green-500/20 text-green-700 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-gray-500/20 text-gray-700 dark:text-gray-300" },
  awaiting_service: { label: "Awaiting Service", className: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  deferred: { label: "Deferred", className: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
};

const PRIORITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: "Critical", className: "bg-red-500/20 text-red-700 dark:text-red-300" },
  2: { label: "High Priority", className: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
  3: { label: "Medium Priority", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" },
  4: { label: "Low Priority", className: "bg-green-500/20 text-green-700 dark:text-green-300" },
};

function InfoCard({ icon: Icon, label, value, subValue }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; subValue?: string }) {
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

export function WorkOrderDetailDrawer({ workOrder, open, onClose, equipment, vessels, crew, onComplete, onEdit, onClone, onDelete, isCompleting = false }: WorkOrderDetailDrawerProps) {
  const {
    activeTab, setActiveTab, linkTemplateDialogOpen, setLinkTemplateDialogOpen,
    workOrderParts, totalPartsCost, totalLaborCost, totalProcurementCost, downtimeCost, procurementCosts, grandTotal, invalidateParts, invalidateChecklist,
  } = useWorkOrderDetailData({ workOrder });
  const [showFeedbackStep, setShowFeedbackStep] = useLocalState(false);
  const [predictionFeedback, setPredictionFeedback] = useLocalState<any>(undefined);

  if (!workOrder) {return null;}

  const isPredictiveWo = workOrder.maintenanceType === "predictive";

  const getEquipmentName = (equipmentId: string) => equipment.find((e) => e.id === equipmentId)?.name || equipmentId?.slice(0, 8) || "Unknown";
  const getEquipmentType = (equipmentId: string) => equipment.find((e) => e.id === equipmentId)?.type || "Equipment";
  const getVesselName = (vesselId: string | null) => !vesselId ? "Not assigned" : vessels.find((v) => v.id === vesselId)?.name || vesselId.slice(0, 8);
  const getCrewName = (crewId: string | null) => !crewId ? "Unassigned" : crew.find((c) => c.id === crewId)?.name || crewId.slice(0, 8);
  const getCrewHourlyRate = (crewId: string | null) => !crewId ? null : crew.find((c) => c.id === crewId)?.hourlyRate || null;
  const assignedCrewRate = getCrewHourlyRate(workOrder.assignedCrewId);
  const calculatedLaborCost = assignedCrewRate && workOrder.laborHours ? assignedCrewRate * workOrder.laborHours : null;

  const statusConfig = STATUS_CONFIG[workOrder.status] || STATUS_CONFIG.open;
  const priorityConfig = PRIORITY_CONFIG[workOrder.priority] || PRIORITY_CONFIG[3];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[540px] lg:w-[640px] p-0 flex flex-col h-dvh max-h-dvh overflow-hidden">
        <SheetHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2 truncate">
                <Wrench className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">{workOrder.woNumber || workOrder.id.slice(0, 8)}</span>
              </SheetTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{getEquipmentName(workOrder.equipmentId)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={cn("text-xs", priorityConfig.className)}>{priorityConfig.label}</Badge>
              <Badge className={cn("text-xs", statusConfig.className)}>{statusConfig.label}</Badge>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b px-2 sm:px-6 h-auto py-0 flex-shrink-0 overflow-x-auto">
            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-details"><FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Details</TabsTrigger>
            <TabsTrigger value="parts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-parts"><Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Parts ({workOrderParts.length})</TabsTrigger>
            <TabsTrigger value="requests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-requests"><Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Requests</TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-tasks"><ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Tasks</TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-history"><History className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />History</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="details" className="mt-0 p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InfoCard icon={Ship} label="Vessel" value={getVesselName(workOrder.vesselId)} />
                <InfoCard icon={Wrench} label="Equipment" value={getEquipmentName(workOrder.equipmentId)} subValue={getEquipmentType(workOrder.equipmentId)} />
                <InfoCard icon={User} label="Assigned To" value={getCrewName(workOrder.assignedCrewId)} subValue={assignedCrewRate ? `$${assignedCrewRate.toFixed(2)}/hr` : undefined} />
                <InfoCard icon={Calendar} label="Due Date" value={workOrder.plannedEndDate ? format(new Date(workOrder.plannedEndDate), "MMM d, yyyy") : "Not set"} />
              </div>
              <Separator />
              <div><h4 className="font-medium mb-2">Reason</h4><p className="text-sm text-muted-foreground">{workOrder.reason || "No reason provided"}</p></div>
              {workOrder.description && <div><h4 className="font-medium mb-2">Description</h4><p className="text-sm text-muted-foreground whitespace-pre-wrap">{workOrder.description}</p></div>}
              {workOrder.costJustification && (
                <div data-testid="cost-justification-section">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                    Cost Justification
                  </h4>
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-md p-3">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workOrder.costJustification}</p>
                  </div>
                </div>
              )}
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" />Cost Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">Internal Costs</div>
                  <div className="flex justify-between" data-testid="cost-internal-parts"><span className="text-muted-foreground">Internal Parts</span><span>${totalPartsCost.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center" data-testid="cost-internal-labor">
                    <span className="text-muted-foreground">Internal Labor</span>
                    <div className="text-right">
                      <span>${totalLaborCost.toFixed(2)}</span>
                      {calculatedLaborCost !== null && calculatedLaborCost !== totalLaborCost && (
                        <span className="text-xs text-muted-foreground block">Est: ${calculatedLaborCost.toFixed(2)} ({workOrder.laborHours}h x ${assignedCrewRate?.toFixed(2)}/hr)</span>
                      )}
                    </div>
                  </div>
                  {downtimeCost > 0 && (
                    <div className="flex justify-between" data-testid="cost-downtime"><span className="text-muted-foreground">Downtime</span><span>${downtimeCost.toFixed(2)}</span></div>
                  )}
                  {totalProcurementCost > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">External Procurement</div>
                      {procurementCosts && procurementCosts.serviceOrderCosts > 0 && (
                        <div className="flex justify-between" data-testid="cost-service-orders">
                          <span className="text-muted-foreground">Service Orders ({procurementCosts.serviceOrderDetails.length})</span>
                          <span>${procurementCosts.serviceOrderCosts.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium text-muted-foreground" data-testid="cost-procurement-subtotal">
                        <span>Procurement Subtotal</span>
                        <span>${totalProcurementCost.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium" data-testid="cost-grand-total"><span>Total Cost</span><span>${grandTotal.toFixed(2)}</span></div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2"><Clock className="h-4 w-4" />Time Tracking</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground block">Estimated Hours</span><span>{workOrder.estimatedDowntimeHours || "—"}h</span></div>
                  <div><span className="text-muted-foreground block">Actual Hours</span><span>{workOrder.actualDowntimeHours || "—"}h</span></div>
                  <div><span className="text-muted-foreground block">Created</span><span>{workOrder.createdAt ? formatDistanceToNow(new Date(workOrder.createdAt), { addSuffix: true }) : "Unknown"}</span></div>
                  <div><span className="text-muted-foreground block">Last Updated</span><span>{workOrder.updatedAt ? formatDistanceToNow(new Date(workOrder.updatedAt), { addSuffix: true }) : "Unknown"}</span></div>
                </div>
              </div>
              <Separator />
              <LinkedServiceOrdersPanel
                workOrderId={workOrder.id}
                workOrderNumber={workOrder.woNumber || workOrder.id.slice(0, 8)}
                workOrderStatus={workOrder.status}
              />
              {showFeedbackStep && workOrder.status !== "completed" && workOrder.status !== "cancelled" && (
                <>
                  <Separator />
                  <PredictionFeedbackForm
                    workOrderId={workOrder.id}
                    onChange={(feedback) => setPredictionFeedback(feedback)}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="parts" className="mt-0 p-4 sm:p-6">
              <MultiPartSelector workOrderId={workOrder.id} onPartsAdded={invalidateParts} />
            </TabsContent>

            <TabsContent value="requests" className="mt-0 p-4 sm:p-6">
              <WorkOrderRequestsTab workOrderId={workOrder.id} isReadOnly={workOrder.status === "completed" || workOrder.status === "cancelled"} requireAdvancedOptions={workOrder.maintenanceType === "drydock"} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 p-4 sm:p-6">
              <WorkOrderTasksTab workOrderId={workOrder.id} isReadOnly={workOrder.status === "completed" || workOrder.status === "cancelled"} />
            </TabsContent>

            <TabsContent value="history" className="mt-0 p-4 sm:p-6">
              <WorkOrderHistoryTab workOrderId={workOrder.id} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-background flex-shrink-0">
          <Button variant="outline" onClick={onClose} data-testid="button-close-wo-drawer" className="order-last sm:order-first">Close</Button>
          <div className="flex flex-wrap gap-2 justify-end">
            {workOrder.status !== "completed" && workOrder.status !== "cancelled" && (
              <Button variant="outline" size="sm" onClick={() => setLinkTemplateDialogOpen(true)} data-testid="button-link-template-drawer" className="text-xs sm:text-sm">
                <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /><span className="hidden xs:inline">Link </span>Template
              </Button>
            )}
            {onClone && <Button variant="outline" size="sm" onClick={() => onClone(workOrder)} data-testid="button-clone-wo-drawer" className="text-xs sm:text-sm"><Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />Clone</Button>}
            <Button variant="outline" size="sm" onClick={() => onEdit(workOrder)} data-testid="button-edit-wo-drawer" className="text-xs sm:text-sm">Edit</Button>
            {onDelete && <Button variant="outline" size="sm" onClick={() => { onClose(); onDelete(workOrder); }} data-testid="button-delete-wo-drawer" className="text-xs sm:text-sm text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />Delete</Button>}
            {workOrder.status !== "completed" && workOrder.status !== "cancelled" && (
              <Button size="sm" onClick={() => {
                if (isPredictiveWo && !showFeedbackStep) {
                  setShowFeedbackStep(true);
                  setActiveTab("details");
                } else {
                  onComplete(workOrder.id);
                  setShowFeedbackStep(false);
                  setPredictionFeedback(undefined);
                }
              }} disabled={isCompleting} data-testid="button-complete-wo-drawer" className="text-xs sm:text-sm">{isCompleting ? "Completing..." : showFeedbackStep ? "Confirm Complete" : "Complete"}</Button>
            )}
          </div>
        </div>

        <LinkTemplateDialog workOrderId={workOrder.id} equipmentType={getEquipmentType(workOrder.equipmentId)} open={linkTemplateDialogOpen} onOpenChange={setLinkTemplateDialogOpen} onSuccess={invalidateChecklist} />
      </SheetContent>
    </Sheet>
  );
}

export default WorkOrderDetailDrawer;
