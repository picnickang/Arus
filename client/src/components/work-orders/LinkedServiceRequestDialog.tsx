import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateServiceRequest } from "@/features/serviceRequests/hooks/useServiceRequests";
import { useToast } from "@/hooks/use-toast";

export function CreateServiceRequestDialog({
  open,
  onClose,
  workOrderId,
  workOrderNumber,
}: {
  open: boolean;
  onClose: () => void;
  workOrderId: string;
  workOrderNumber: string;
}) {
  const { toast } = useToast();
  const createMutation = useCreateServiceRequest();

  const [form, setForm] = useState({
    title: "",
    description: "",
    urgency: "medium",
    estimatedCost: "",
  });

  const handleSubmit = async () => {
    try {
      await createMutation.mutateAsync({
        workOrderId,
        data: {
          title: form.title,
          urgency: form.urgency,
          ...(form.description ? { description: form.description } : {}),
          ...(form.estimatedCost ? { estimatedCost: parseFloat(form.estimatedCost) } : {}),
        },
      });
      toast({
        title: "Service request submitted",
        description: `Linked to ${workOrderNumber}. Procurement will review.`,
      });
      onClose();
      setForm({ title: "", description: "", urgency: "medium", estimatedCost: "" });
    } catch (err) {
      toast({
        title: "Failed to create service request",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request External Service</DialogTitle>
          <DialogDescription>
            Submit a service request for {workOrderNumber}. Procurement will review and convert it
            to a formal Service Order if approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Brief description of the service needed..."
              data-testid="input-sr-title"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Detailed description of the external service needed..."
              rows={3}
              data-testid="input-sr-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Urgency</Label>
              <Select
                value={form.urgency}
                onValueChange={(v) => setForm((p) => ({ ...p, urgency: v }))}
              >
                <SelectTrigger data-testid="select-sr-urgency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estimated Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={form.estimatedCost}
                onChange={(e) => setForm((p) => ({ ...p, estimatedCost: e.target.value }))}
                placeholder="0.00"
                data-testid="input-sr-cost"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !form.title.trim()}
            data-testid="button-submit-service-request"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
