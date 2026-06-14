import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Wrench, FileText, Clock } from "lucide-react";
import { useDiscardGuard, DiscardConfirmDialog } from "@/hooks/useDiscardGuard";
import type { WorkOrder } from "@shared/schema";
import { useWorkOrderFormDialogData, type WorkOrderFormData } from "@/features/work-orders";
import { WorkOrderFormFields } from "./WorkOrderFormFields";

interface WorkOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  workOrder?: WorkOrder | null | undefined;
  onSubmit: (data: WorkOrderFormData & { templateId?: string }) => void;
  isSubmitting?: boolean | undefined;
  defaultVesselId?: string | undefined;
  defaultEquipmentId?: string | undefined;
}

export function WorkOrderFormDialog({
  open,
  onOpenChange,
  mode,
  workOrder,
  onSubmit,
  isSubmitting = false,
  defaultVesselId,
  defaultEquipmentId,
}: WorkOrderFormDialogProps) {
  const {
    form,
    isEditMode,
    selectedVesselId,
    selectedEquipmentId,
    selectedTemplateId,
    vessels,
    filteredEquipment,
    crewMembers,
    filteredTemplates,
    applyTemplate,
    clearTemplate,
  } = useWorkOrderFormDialogData({
    open,
    mode,
    ...(workOrder !== undefined && { workOrder }),
    ...(defaultVesselId !== undefined && { defaultVesselId }),
    ...(defaultEquipmentId !== undefined && { defaultEquipmentId }),
  });

  const handleSubmit = (data: WorkOrderFormData) =>
    onSubmit({ ...data, ...(selectedTemplateId && { templateId: selectedTemplateId }) });

  const guard = useDiscardGuard({ isDirty: form.formState.isDirty, onOpenChange });

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent
        className="max-w-2xl w-[95vw] md:w-auto max-h-[90vh] overflow-y-auto"
        data-testid="work-order-form-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {isEditMode ? "Edit Work Order" : "Create Work Order"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Update work order ${workOrder?.woNumber || workOrder?.id || ""}`
              : "Create a new maintenance work order for equipment"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vesselId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-vessel">
                          <SelectValue placeholder="Select vessel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vessels
                          .filter((v) => v.id && v.name)
                          .map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEditMode || !selectedVesselId}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-equipment">
                          <SelectValue
                            placeholder={
                              isEditMode
                                ? "Loading..."
                                : selectedVesselId
                                  ? "Select equipment"
                                  : "Select vessel first"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredEquipment
                          .filter((eq) => eq.id && eq.id.trim() !== "")
                          .map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.name || eq.id} {eq.type ? `(${eq.type})` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {!isEditMode && selectedVesselId && filteredEquipment.length === 0 && (
                      <FormDescription className="text-muted-foreground">
                        No equipment found for this vessel
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!isEditMode && selectedEquipmentId && filteredTemplates.length > 0 && (
              <div className="space-y-2" data-testid="template-selector-section">
                <Separator className="my-2" />
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <FormLabel className="text-sm font-medium">Apply Maintenance Template</FormLabel>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(value) =>
                      value === "none" ? clearTemplate() : applyTemplate(value)
                    }
                  >
                    <SelectTrigger data-testid="select-template" className="flex-1">
                      <SelectValue placeholder="Select a template to pre-fill form (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" data-testid="template-option-none">
                        <span className="text-muted-foreground">No template</span>
                      </SelectItem>
                      {filteredTemplates.map((template) => (
                        <SelectItem
                          key={template.id}
                          value={template.id}
                          data-testid={`template-option-${template.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <span data-testid={`template-name-${template.id}`}>
                              {template.name}
                            </span>
                            {template.priority && template.priority <= 2 && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                data-testid={`template-priority-${template.id}`}
                              >
                                P{template.priority}
                              </Badge>
                            )}
                            {template.estimatedDurationHours && (
                              <span
                                className="text-xs text-muted-foreground flex items-center gap-1"
                                data-testid={`template-duration-${template.id}`}
                              >
                                <Clock className="h-3 w-3" />
                                {template.estimatedDurationHours}h
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplateId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearTemplate}
                      data-testid="button-clear-template"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {selectedTemplateId && (
                  <FormDescription
                    className="text-xs text-green-600"
                    data-testid="template-applied-status"
                  >
                    Template applied - form fields have been pre-filled
                  </FormDescription>
                )}
                <Separator className="my-2" />
              </div>
            )}

            <WorkOrderFormFields
              form={form}
              isEditMode={isEditMode}
              selectedVesselId={selectedVesselId}
              crewMembers={crewMembers}
              workOrder={workOrder}
              isSubmitting={isSubmitting}
              onCancel={() => guard.handleOpenChange(false)}
            />
          </form>
        </Form>
      </DialogContent>
      <DiscardConfirmDialog
        open={guard.confirmOpen}
        onConfirm={guard.onConfirm}
        onCancel={guard.onCancel}
      />
    </Dialog>
  );
}
