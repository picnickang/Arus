/**
 * Resolve dialog for the office feedback review queue.
 *
 * Captures an optional resolution note and an optional link to the work
 * order raised from the report, then PATCHes /api/feedback-review/:id.
 * Kept as a sibling module so the page stays under the long-file ceiling.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ReviewEntry } from "./review-types";

interface WorkOrderOption {
  id: string;
  woNumber?: string | null;
  description?: string | null;
  status?: string | null;
}

const NO_WORK_ORDER = "none";

export function ResolveDialog({
  entry,
  onOpenChange,
}: {
  entry: ReviewEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [workOrderId, setWorkOrderId] = useState<string>(NO_WORK_ORDER);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const workOrders = useQuery<WorkOrderOption[]>({
    queryKey: ["/api/work-orders"],
    enabled: entry !== null,
    staleTime: 60_000,
  });
  const openWorkOrders = (workOrders.data ?? [])
    .filter((wo) => wo.status !== "completed" && wo.status !== "closed")
    .slice(0, 50);

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!entry) {
        throw new Error("No report selected");
      }
      return apiRequest("PATCH", `/api/feedback-review/${entry.id}`, {
        status: "resolved",
        resolutionNote: note.trim() || undefined,
        linkedWorkOrderId: workOrderId === NO_WORK_ORDER ? null : workOrderId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback-review"] });
      toast({ title: "Report resolved" });
      setNote("");
      setWorkOrderId(NO_WORK_ORDER);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not resolve report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-feedback-resolve">
        <DialogHeader>
          <DialogTitle>Resolve report</DialogTitle>
          <DialogDescription>
            {entry ? `${entry.trackingId} — ${entry.subject}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolution-note">Resolution note</Label>
            <Textarea
              id="resolution-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What was done about this report? (optional)"
              maxLength={2000}
              rows={4}
              data-testid="input-resolution-note"
            />
          </div>
          <div className="space-y-2">
            <Label>Linked work order</Label>
            <Select value={workOrderId} onValueChange={setWorkOrderId}>
              <SelectTrigger data-testid="select-resolve-wo">
                <SelectValue placeholder="No work order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_WORK_ORDER}>No work order</SelectItem>
                {openWorkOrders.map((wo) => (
                  <SelectItem key={wo.id} value={wo.id}>
                    {wo.woNumber ?? wo.id}
                    {wo.description ? ` — ${wo.description.slice(0, 60)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
            data-testid="button-resolve-confirm"
          >
            {resolveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
