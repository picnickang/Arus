import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUpdateServiceRequest } from "../hooks/useServiceRequests";
import { useToast } from "@/hooks/use-toast";
import {
  editServiceRequestSchema,
  toUpdatePayload,
  type EditServiceRequestFormData,
} from "../lib/editServiceRequestSchema";
import type { ServiceRequest } from "../types";

interface EditServiceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequest: ServiceRequest | null;
}

export function EditServiceRequestDialog({
  open,
  onOpenChange,
  serviceRequest,
}: EditServiceRequestDialogProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateServiceRequest();

  const form = useForm<EditServiceRequestFormData, unknown, EditServiceRequestFormData>({
    resolver: zodResolver(editServiceRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      urgency: "medium",
      estimatedCost: null,
      serviceDetails: "",
      specialRequirements: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (serviceRequest && open) {
      form.reset({
        title: serviceRequest.title || "",
        description: serviceRequest.description || "",
        urgency: serviceRequest.urgency || "medium",
        estimatedCost: serviceRequest.estimatedCost != null ? serviceRequest.estimatedCost : null,
        serviceDetails: serviceRequest.serviceDetails || "",
        specialRequirements: serviceRequest.specialRequirements || "",
      });
    }
  }, [serviceRequest, open, form]);

  if (!serviceRequest) {
    return null;
  }

  const isApproved = serviceRequest.status === "approved";

  const onSubmit = (data: EditServiceRequestFormData) => {
    updateMutation.mutate(
      {
        id: serviceRequest.id,
        data: toUpdatePayload(data),
      },
      {
        onSuccess: () => {
          toast({
            title: "Service request updated",
            description: isApproved
              ? "Changes saved. They will be used when you convert to a Service Order."
              : "Changes saved.",
          });
          onOpenChange(false);
        },
        onError: (err) =>
          toast({ title: "Failed to update", description: String(err), variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Service Request {serviceRequest.requestNumber}</DialogTitle>
          <DialogDescription>
            {isApproved
              ? "This request is approved. Updates here will be reflected when it is converted to a Service Order."
              : "Update the details of this service request."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-sr-title" />
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
                      <Textarea {...field} data-testid="input-edit-sr-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-sr-urgency">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimatedCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Cost</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          data-testid="input-edit-sr-cost"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="serviceDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Details</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-edit-sr-details" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialRequirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Requirements</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-edit-sr-special" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="btn-cancel-edit-sr"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="btn-save-edit-sr"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
