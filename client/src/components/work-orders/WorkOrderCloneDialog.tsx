import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Calendar, CheckSquare, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkOrder } from "@shared/schema";

const cloneFormSchema = z
  .object({
    plannedStartDate: z.string().optional(),
    plannedEndDate: z.string().optional(),
    includeTasks: z.boolean().default(true),
    includeParts: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.plannedStartDate && data.plannedEndDate) {
        return new Date(data.plannedEndDate) >= new Date(data.plannedStartDate);
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["plannedEndDate"],
    }
  );

type CloneFormValues = z.infer<typeof cloneFormSchema>;

interface WorkOrderCloneDialogProps {
  workOrder: WorkOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (clonedWorkOrder: WorkOrder) => void;
}

export function WorkOrderCloneDialog({
  workOrder,
  open,
  onOpenChange,
  onSuccess,
}: WorkOrderCloneDialogProps) {
  const { toast } = useToast();
  const _queryClient = useQueryClient();

  const form = useForm<CloneFormValues, unknown, CloneFormValues>({
    resolver: zodResolver(cloneFormSchema),
    defaultValues: {
      plannedStartDate: "",
      plannedEndDate: "",
      includeTasks: true,
      includeParts: true,
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (values: CloneFormValues) => {
      if (!workOrder) {
        throw new Error("No work order to clone");
      }

      const payload: Record<string, unknown> = {
        includeTasks: values.includeTasks,
        includeParts: values.includeParts,
      };

      if (values.plannedStartDate) {
        payload['plannedStartDate'] = new Date(values.plannedStartDate).toISOString();
      }

      if (values.plannedEndDate) {
        payload['plannedEndDate'] = new Date(values.plannedEndDate).toISOString();
      }

      return apiRequest<WorkOrder>("POST", `/api/work-orders/${workOrder.id}/clone`, payload);
    },
    onSuccess: (clonedWorkOrder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Work Order Cloned",
        description: `Created new work order ${clonedWorkOrder.woNumber}`,
      });
      onOpenChange(false);
      form.reset();
      onSuccess?.(clonedWorkOrder);
    },
    onError: (error) => {
      toast({
        title: "Clone Failed",
        description: error instanceof Error ? error.message : "Failed to clone work order",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CloneFormValues) => {
    cloneMutation.mutate(values);
  };

  if (!workOrder) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="work-order-clone-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Work Order
          </DialogTitle>
          <DialogDescription>
            Create a copy of work order{" "}
            <span className="font-medium">{workOrder.woNumber || workOrder.id.slice(0, 8)}</span>.
            The new work order will have status "Open" with a new WO number.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="rounded-lg border p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Original Work Order</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">Reason:</span> {workOrder.reason || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Type:</span> {workOrder.maintenanceType || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Priority:</span> {workOrder.priority}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plannedStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned Start</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-clone-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plannedEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned End</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-clone-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to create work order without scheduled dates.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Include in Clone</h4>

              <FormField
                control={form.control}
                name="includeTasks"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-include-tasks"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" />
                        Tasks/Checklist
                      </FormLabel>
                      <FormDescription>
                        Copy all tasks from the original work order (uncompleted)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includeParts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-include-parts"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Parts List
                      </FormLabel>
                      <FormDescription>
                        Copy parts list as planned quantities (no inventory reserved)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-clone-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={cloneMutation.isPending}
                data-testid="button-clone-submit"
              >
                {cloneMutation.isPending ? (
                  <>
                    <Copy className="mr-2 h-4 w-4 animate-spin" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Clone Work Order
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
