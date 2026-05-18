import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<string>("medium");
  const [estimatedCost, setEstimatedCost] = useState<string>("");
  const [serviceDetails, setServiceDetails] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");

  useEffect(() => {
    if (serviceRequest && open) {
      setTitle(serviceRequest.title || "");
      setDescription(serviceRequest.description || "");
      setUrgency(serviceRequest.urgency || "medium");
      setEstimatedCost(
        serviceRequest.estimatedCost != null ? String(serviceRequest.estimatedCost) : ""
      );
      setServiceDetails(serviceRequest.serviceDetails || "");
      setSpecialRequirements(serviceRequest.specialRequirements || "");
    }
  }, [serviceRequest, open]);

  if (!serviceRequest) {
    return null;
  }

  const isApproved = serviceRequest.status === "approved";

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    // NOTE: use null (not undefined) for cleared optional fields so the
    // backend PATCH actually clears them instead of leaving the prior value.
    updateMutation.mutate(
      {
        id: serviceRequest.id,
        data: {
          title: title.trim(),
          description: (description || null) as any,
          urgency,
          estimatedCost: estimatedCost ? parseFloat(estimatedCost) : (null as any),
          serviceDetails: (serviceDetails || null) as any,
          specialRequirements: (specialRequirements || null) as any,
        },
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
        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-sr-title">Title *</Label>
            <Input
              id="edit-sr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-edit-sr-title"
            />
          </div>
          <div>
            <Label htmlFor="edit-sr-description">Description</Label>
            <Textarea
              id="edit-sr-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-edit-sr-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger data-testid="select-edit-sr-urgency">
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
            <div>
              <Label htmlFor="edit-sr-cost">Estimated Cost</Label>
              <Input
                id="edit-sr-cost"
                type="number"
                step="0.01"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                data-testid="input-edit-sr-cost"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-sr-details">Service Details</Label>
            <Textarea
              id="edit-sr-details"
              value={serviceDetails}
              onChange={(e) => setServiceDetails(e.target.value)}
              data-testid="input-edit-sr-details"
            />
          </div>
          <div>
            <Label htmlFor="edit-sr-special">Special Requirements</Label>
            <Textarea
              id="edit-sr-special"
              value={specialRequirements}
              onChange={(e) => setSpecialRequirements(e.target.value)}
              data-testid="input-edit-sr-special"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="btn-cancel-edit-sr"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            data-testid="btn-save-edit-sr"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
