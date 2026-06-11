import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { ArrowRightCircle, Loader2, XCircle } from "lucide-react";

export interface ConvertToSOData {
  serviceProviderId: string;
  scope?: string;
  estimatedCost?: number;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
}

interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srId: string | null;
  isPending: boolean;
  onSubmit: (data: ConvertToSOData) => void;
}

export function ConvertToSODialog({
  open,
  onOpenChange,
  srId: _srId,
  onSubmit,
  isPending,
}: ConvertDialogProps) {
  const [scope, setScope] = useState("");
  const [serviceProviderId, setServiceProviderId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [scheduledStartDate, setScheduledStartDate] = useState("");
  const [scheduledEndDate, setScheduledEndDate] = useState("");
  const { data: suppliers } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/suppliers"],
    enabled: open,
  });

  const handleSubmit = () => {
    if (!serviceProviderId) {
      return;
    }
    onSubmit({
      serviceProviderId,
      ...(scope ? { scope } : {}),
      ...(estimatedCost ? { estimatedCost: parseFloat(estimatedCost) } : {}),
      ...(scheduledStartDate ? { scheduledStartDate } : {}),
      ...(scheduledEndDate ? { scheduledEndDate } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to Service Order</DialogTitle>
          <DialogDescription>
            Create a formal service order from this approved request.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Service Provider *</Label>
            <Select value={serviceProviderId} onValueChange={setServiceProviderId}>
              <SelectTrigger data-testid="select-convert-provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Scope of Work</Label>
            <Textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Describe the work scope..."
              data-testid="input-convert-scope"
            />
          </div>
          <div>
            <Label>Estimated Cost</Label>
            <Input
              type="number"
              step="0.01"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="0.00"
              data-testid="input-convert-cost"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scheduled Start</Label>
              <Input
                type="date"
                value={scheduledStartDate}
                onChange={(e) => setScheduledStartDate(e.target.value)}
                data-testid="input-convert-start-date"
              />
            </div>
            <div>
              <Label>Scheduled End</Label>
              <Input
                type="date"
                value={scheduledEndDate}
                onChange={(e) => setScheduledEndDate(e.target.value)}
                data-testid="input-convert-end-date"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="btn-cancel-convert"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!serviceProviderId || isPending}
            data-testid="btn-submit-convert"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <ArrowRightCircle className="h-4 w-4 mr-2" /> Convert to SO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srId: string | null;
  isPending: boolean;
  onSubmit: (reason: string) => void;
}

export function RejectDialog({
  open,
  onOpenChange,
  srId: _srId,
  onSubmit,
  isPending,
}: RejectDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Service Request</DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting this request. The work order status will be restored.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this request is being rejected..."
            data-testid="input-reject-reason"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="btn-cancel-reject"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit(reason)}
            disabled={isPending}
            data-testid="btn-submit-reject"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <XCircle className="h-4 w-4 mr-2" /> Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
