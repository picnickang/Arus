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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Wrench, FileText, Clock, DollarSign } from "lucide-react";
import { useDiscardGuard, DiscardConfirmDialog } from "@/hooks/useDiscardGuard";
import type { WorkOrder } from "@shared/schema";
import {
  useWorkOrderFormDialogData,
  MAINTENANCE_TYPES,
  WORK_ORDER_FORM_PRIORITY_OPTIONS,
  WORK_ORDER_FORM_STATUS_OPTIONS,
  type WorkOrderFormData,
} from "@/features/work-orders";

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maintenanceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maintenance Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-maintenance-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MAINTENANCE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number.parseInt(value))}
                      value={field.value?.toString() || "3"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_ORDER_FORM_PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            <span className={option.color}>{option.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isEditMode && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_ORDER_FORM_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="assignedCrewId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to Crew Member</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                    disabled={!selectedVesselId}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-crew">
                        <SelectValue
                          placeholder={
                            selectedVesselId
                              ? "Select crew member (optional)"
                              : "Select vessel first"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {crewMembers
                        .filter((c) => c.id && c.name)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} - {c.rank || "Crew"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedVesselId && crewMembers.length === 0 && (
                    <FormDescription className="text-muted-foreground">
                      No crew members found for this vessel
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe the maintenance issue..."
                      data-testid="input-reason"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional details (optional)"
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="plannedStartDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Planned Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-planned-start-date"
                          >
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plannedEndDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Planned End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-planned-end-date"
                          >
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) => {
                            const startDate = form.getValues("plannedStartDate");
                            return startDate ? date < startDate : false;
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="0.0"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        data-testid="input-estimated-hours"
                      />
                    </FormControl>
                    <FormDescription>Estimated labor hours for this work order</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedDowntimeHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Downtime (hours)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="0.0"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        data-testid="input-estimated-downtime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="affectsVesselDowntime"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-affects-downtime"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Affects Vessel Downtime</FormLabel>
                    <FormDescription>
                      Track this work order as impacting vessel operational availability
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {workOrder?.costJustification && (
              <div
                className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 space-y-2"
                data-testid="form-cost-justification"
              >
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium text-sm">
                  <DollarSign className="h-4 w-4" />
                  Cost Justification
                </div>
                <p
                  className="text-sm text-muted-foreground whitespace-pre-wrap"
                  data-testid="text-cost-justification"
                >
                  {workOrder.costJustification}
                </p>
                {workOrder.laborCost != null && (
                  <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                    <span data-testid="text-labor-cost">
                      Estimated Labor Cost: ${workOrder.laborCost.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => guard.handleOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "Update Work Order" : "Create Work Order"}
              </Button>
            </div>
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
