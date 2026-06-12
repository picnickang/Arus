import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, DollarSign, Loader2 } from "lucide-react";
import type { WorkOrder } from "@shared/schema";
import {
  MAINTENANCE_TYPES,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  type WorkOrderFormData,
  type useWorkOrderFormDialogData,
} from "@/features/work-orders";

type WorkOrderFormDialogData = ReturnType<typeof useWorkOrderFormDialogData>;

interface WorkOrderFormFieldsProps {
  form: WorkOrderFormDialogData["form"];
  isEditMode: boolean;
  selectedVesselId: string | null;
  crewMembers: WorkOrderFormDialogData["crewMembers"];
  workOrder?: WorkOrder | null | undefined;
  isSubmitting: boolean;
  onCancel: () => void;
}

export function WorkOrderFormFields({
  form,
  isEditMode,
  selectedVesselId,
  crewMembers,
  workOrder,
  isSubmitting,
  onCancel,
}: WorkOrderFormFieldsProps) {
  return (
    <>
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
                  {PRIORITY_OPTIONS.map((option) => (
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
                  {STATUS_OPTIONS.map((option) => (
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
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!selectedVesselId}>
              <FormControl>
                <SelectTrigger data-testid="select-crew">
                  <SelectValue
                    placeholder={selectedVesselId ? "Select crew member (optional)" : "Select vessel first"}
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
              <Textarea {...field} placeholder="Describe the maintenance issue..." data-testid="input-reason" />
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
                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      data-testid="input-planned-start-date"
                    >
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
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
                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
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
          <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-cost-justification">
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Update Work Order" : "Create Work Order"}
        </Button>
      </div>
    </>
  );
}
