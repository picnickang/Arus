import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldAlert, Wrench, RefreshCw } from "lucide-react";
import { useCreateServiceOrder, useUpdateServiceOrder, useSendServiceOrder, useCancelServiceOrder } from "../hooks/useServiceOrders";
import { useToast } from "@/hooks/use-toast";
import { useCanModifyRecord } from "@/hooks/useUserPermissions";
import type { ServiceOrder, SOType, SOUrgency } from "../types";
import { SO_TYPE_LABELS, SO_URGENCY_LABELS } from "../types";

const soFormSchema = z.object({
  serviceType: z.enum(["service", "replacement_quote"]).default("service"),
  serviceProviderId: z.string().min(1, "Service provider is required"),
  workOrderId: z.string().optional(),
  vesselId: z.string().optional(),
  scope: z.string().min(1, "Scope/description is required"),
  scheduledStartDate: z.string().optional(),
  scheduledEndDate: z.string().optional(),
  estimatedDurationHours: z.string().optional(),
  quotedAmount: z.string().optional(),
  currency: z.string().optional(),
  specialRequirements: z.string().optional(),
  urgency: z.enum(["routine", "urgent", "critical"]).optional(),
  budgetMin: z.string().optional(),
  budgetMax: z.string().optional(),
  downtimeWindowStart: z.string().optional(),
  downtimeWindowEnd: z.string().optional(),
  justification: z.string().optional(),
  responseDeadline: z.string().optional(),
});

type SOFormValues = z.infer<typeof soFormSchema>;

interface ServiceOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  serviceOrder?: ServiceOrder | null;
  onSuccess?: () => void;
}

export function ServiceOrderFormDialog({ open, onOpenChange, mode, serviceOrder, onSuccess }: ServiceOrderFormDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateServiceOrder();
  const updateMutation = useUpdateServiceOrder();
  const sendMutation = useSendServiceOrder();
  const cancelMutation = useCancelServiceOrder();

  const { data: suppliers, isLoading: loadingSuppliers } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/suppliers"] });
  const { data: workOrders, isLoading: loadingWOs } = useQuery<{ id: string; woNumber: string; reason?: string }[]>({ queryKey: ["/api/work-orders"] });
  const { data: vessels, isLoading: loadingVessels } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/vessels"] });

  const isLoadingData = loadingSuppliers || loadingWOs || loadingVessels;

  const form = useForm<SOFormValues>({
    resolver: zodResolver(soFormSchema),
    defaultValues: {
      serviceType: "service",
      serviceProviderId: "",
      workOrderId: "__none__",
      vesselId: "__none__",
      scope: "",
      scheduledStartDate: "",
      scheduledEndDate: "",
      estimatedDurationHours: "",
      quotedAmount: "",
      currency: "USD",
      specialRequirements: "",
      urgency: undefined,
      budgetMin: "",
      budgetMax: "",
      downtimeWindowStart: "",
      downtimeWindowEnd: "",
      justification: "",
      responseDeadline: "",
    },
  });

  const serviceType = useWatch({ control: form.control, name: "serviceType" });
  const isReplacementQuote = serviceType === "replacement_quote";

  useEffect(() => {
    if (!open) return;
    
    if (mode === "edit" && serviceOrder) {
      form.reset({
        serviceType: serviceOrder.serviceType || "service",
        serviceProviderId: serviceOrder.serviceProviderId || "",
        workOrderId: serviceOrder.workOrderId || "__none__",
        vesselId: serviceOrder.vesselId || "__none__",
        scope: serviceOrder.scope || "",
        scheduledStartDate: serviceOrder.scheduledStartDate ? new Date(serviceOrder.scheduledStartDate).toISOString().split("T")[0] : "",
        scheduledEndDate: serviceOrder.scheduledEndDate ? new Date(serviceOrder.scheduledEndDate).toISOString().split("T")[0] : "",
        estimatedDurationHours: serviceOrder.estimatedDurationHours?.toString() || "",
        quotedAmount: serviceOrder.quotedAmount?.toString() || "",
        currency: serviceOrder.currency || "USD",
        specialRequirements: serviceOrder.specialRequirements || "",
        urgency: serviceOrder.urgency || undefined,
        budgetMin: serviceOrder.budgetMin?.toString() || "",
        budgetMax: serviceOrder.budgetMax?.toString() || "",
        downtimeWindowStart: serviceOrder.downtimeWindowStart ? new Date(serviceOrder.downtimeWindowStart).toISOString().split("T")[0] : "",
        downtimeWindowEnd: serviceOrder.downtimeWindowEnd ? new Date(serviceOrder.downtimeWindowEnd).toISOString().split("T")[0] : "",
        justification: serviceOrder.justification || "",
        responseDeadline: serviceOrder.responseDeadline ? new Date(serviceOrder.responseDeadline).toISOString().split("T")[0] : "",
      });
    } else if (mode === "create") {
      form.reset({
        serviceType: "service",
        serviceProviderId: "",
        workOrderId: "__none__",
        vesselId: "__none__",
        scope: "",
        scheduledStartDate: "",
        scheduledEndDate: "",
        estimatedDurationHours: "",
        quotedAmount: "",
        currency: "USD",
        specialRequirements: "",
        urgency: undefined,
        budgetMin: "",
        budgetMax: "",
        downtimeWindowStart: "",
        downtimeWindowEnd: "",
        justification: "",
        responseDeadline: "",
      });
    }
  }, [mode, serviceOrder, open, form]);

  const onSubmit = async (values: SOFormValues) => {
    const baseData = {
      serviceType: values.serviceType,
      serviceProviderId: values.serviceProviderId,
      workOrderId: values.workOrderId === "__none__" ? undefined : values.workOrderId || undefined,
      vesselId: values.vesselId === "__none__" ? undefined : values.vesselId || undefined,
      scope: values.scope.trim(),
      scheduledStartDate: values.scheduledStartDate ? new Date(values.scheduledStartDate) : undefined,
      scheduledEndDate: values.scheduledEndDate ? new Date(values.scheduledEndDate) : undefined,
      estimatedDurationHours: values.estimatedDurationHours ? parseFloat(values.estimatedDurationHours) : undefined,
      quotedAmount: values.quotedAmount ? parseFloat(values.quotedAmount) : undefined,
      currency: values.currency || undefined,
      specialRequirements: values.specialRequirements?.trim() || undefined,
      urgency: values.urgency || undefined,
      budgetMin: values.budgetMin ? parseFloat(values.budgetMin) : undefined,
      budgetMax: values.budgetMax ? parseFloat(values.budgetMax) : undefined,
      downtimeWindowStart: values.downtimeWindowStart ? new Date(values.downtimeWindowStart) : undefined,
      downtimeWindowEnd: values.downtimeWindowEnd ? new Date(values.downtimeWindowEnd) : undefined,
      justification: values.justification?.trim() || undefined,
      responseDeadline: values.responseDeadline ? new Date(values.responseDeadline) : undefined,
    };

    const data = mode === "create" 
      ? { ...baseData, status: "draft" } 
      : baseData;

    try {
      if (mode === "edit" && serviceOrder) {
        await updateMutation.mutateAsync({ id: serviceOrder.id, data });
        toast({ title: "Service Order Updated", description: "The service order has been updated successfully." });
      } else {
        await createMutation.mutateAsync(data);
        toast({ title: "Service Order Created", description: "The service order has been created successfully." });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  const handleSend = async () => {
    if (!serviceOrder?.id) return;
    try {
      await sendMutation.mutateAsync(serviceOrder.id);
      toast({ title: "Service Order Sent", description: "The service order has been sent to the provider." });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    if (!serviceOrder?.id) return;
    try {
      await cancelMutation.mutateAsync({ id: serviceOrder.id });
      toast({ title: "Service Order Cancelled", description: "The service order has been cancelled." });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending || sendMutation.isPending || cancelMutation.isPending;
  const isDraft = serviceOrder?.status === "draft";
  const canCancel = serviceOrder && !["completed", "cancelled"].includes(serviceOrder.status);

  const { canModify, isLoading: loadingPermissions } = useCanModifyRecord(
    "service_orders",
    serviceOrder?.status
  );
  const canEditForm = mode === "create" || canModify;
  const showPermissionWarning = mode === "edit" && !isDraft && !canModify && !loadingPermissions;

  if (isLoadingData && mode === "edit") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Service Order" : "Create Service Order"}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Update the service order details" : "Create a new service order for external service providers"}
          </DialogDescription>
        </DialogHeader>

        {showPermissionWarning && (
          <Alert variant="destructive" data-testid="alert-no-edit-permission">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              This service order has been submitted. Only users with approval permissions can modify it.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="serviceType" render={({ field }) => (
              <FormItem>
                <FormLabel>Request Type *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={!canEditForm}>
                  <FormControl>
                    <SelectTrigger data-testid="select-service-type">
                      <SelectValue placeholder="Select request type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="service">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        {SO_TYPE_LABELS.service}
                      </div>
                    </SelectItem>
                    <SelectItem value="replacement_quote">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        {SO_TYPE_LABELS.replacement_quote}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {isReplacementQuote 
                    ? "Request a quote for equipment replacement" 
                    : "Request service or repair for equipment"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="serviceProviderId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Provider *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canEditForm}>
                    <FormControl><SelectTrigger data-testid="select-provider"><SelectValue placeholder="Select provider" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="workOrderId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Order (Optional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canEditForm}>
                    <FormControl><SelectTrigger data-testid="select-work-order"><SelectValue placeholder="Select work order" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {workOrders?.map(wo => <SelectItem key={wo.id} value={wo.id}>{wo.woNumber || wo.reason}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="vesselId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vessel</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canEditForm}>
                    <FormControl><SelectTrigger data-testid="select-vessel"><SelectValue placeholder="Select vessel" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {vessels?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canEditForm}>
                    <FormControl><SelectTrigger data-testid="select-currency"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="SGD">SGD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="scope" render={({ field }) => (
              <FormItem>
                <FormLabel>Scope / Description *</FormLabel>
                <FormControl><Textarea {...field} placeholder="Describe the service required..." rows={3} data-testid="input-scope" disabled={!canEditForm} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="scheduledStartDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-start-date" disabled={!canEditForm} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="scheduledEndDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled End Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-end-date" disabled={!canEditForm} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="estimatedDurationHours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Duration (hours)</FormLabel>
                  <FormControl><Input type="number" {...field} placeholder="e.g., 8" data-testid="input-duration" disabled={!canEditForm} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quotedAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quoted Amount</FormLabel>
                  <FormControl><Input type="number" {...field} placeholder="e.g., 5000" data-testid="input-quote" disabled={!canEditForm} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="specialRequirements" render={({ field }) => (
              <FormItem>
                <FormLabel>Special Requirements</FormLabel>
                <FormControl><Textarea {...field} placeholder="Any special requirements or notes..." rows={2} data-testid="input-requirements" disabled={!canEditForm} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {isReplacementQuote && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-medium text-muted-foreground">Replacement Quote Details</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="urgency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgency</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange} disabled={!canEditForm}>
                        <FormControl>
                          <SelectTrigger data-testid="select-urgency">
                            <SelectValue placeholder="Select urgency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="routine">{SO_URGENCY_LABELS.routine}</SelectItem>
                          <SelectItem value="urgent">{SO_URGENCY_LABELS.urgent}</SelectItem>
                          <SelectItem value="critical">{SO_URGENCY_LABELS.critical}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="responseDeadline" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Response Deadline</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-response-deadline" disabled={!canEditForm} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="budgetMin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Min</FormLabel>
                      <FormControl><Input type="number" {...field} placeholder="e.g., 10000" data-testid="input-budget-min" disabled={!canEditForm} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="budgetMax" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Max</FormLabel>
                      <FormControl><Input type="number" {...field} placeholder="e.g., 25000" data-testid="input-budget-max" disabled={!canEditForm} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="downtimeWindowStart" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Downtime Window Start</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-downtime-start" disabled={!canEditForm} /></FormControl>
                      <FormDescription>When vessel can be taken offline</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="downtimeWindowEnd" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Downtime Window End</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-downtime-end" disabled={!canEditForm} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="justification" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Replacement Justification</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Explain why this equipment needs to be replaced (e.g., repeated failures, end of life, performance issues)..." 
                        rows={3} 
                        data-testid="input-justification" 
                        disabled={!canEditForm} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {mode === "edit" && canCancel && canModify && (
                <Button type="button" variant="destructive" onClick={handleCancel} disabled={isSubmitting} data-testid="button-cancel-order">
                  Cancel Order
                </Button>
              )}
              {mode === "edit" && isDraft && canModify && (
                <Button type="button" variant="secondary" onClick={handleSend} disabled={isSubmitting} data-testid="button-send-order">
                  Send to Provider
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-dialog">Close</Button>
                {canEditForm && (
                  <Button type="submit" disabled={isSubmitting} data-testid="button-save-so">
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {mode === "edit" ? "Save Changes" : "Create Service Order"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
