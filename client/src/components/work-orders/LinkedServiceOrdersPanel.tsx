/**
 * LinkedServiceOrdersPanel
 *
 * Shows inside the Work Order detail drawer / detail page.
 * Displays all service orders linked to this work order, with:
 *   - SO number, status badge, provider name
 *   - Scheduled dates and estimated cost
 *   - Direct link to the service order
 *   - "Request External Service" button to create a new SO
 *
 * Usage:
 *   <LinkedServiceOrdersPanel workOrderId={wo.id} workOrderNumber={wo.workOrderNumber} />
 */

import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, ExternalLink, Plus, Loader2, Calendar, DollarSign,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useWorkOrderServiceOrders,
  useCreateServiceOrderFromWO,
  type LinkedServiceOrder,
} from "@/features/work-orders/hooks/useWoSoBridge";

// ─── Status helpers ─────────────────────────────────────────────────────────

function soStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed": return "default";
    case "in_progress": return "secondary";
    case "cancelled": return "destructive";
    case "draft": case "sent": return "outline";
    default: return "outline";
  }
}

function soStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    sent: "Sent to Provider",
    confirmed: "Confirmed",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

// ─── Create SO Dialog ───────────────────────────────────────────────────────

function CreateSOFromWODialog({
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
  const createMutation = useCreateServiceOrderFromWO();

  const { data: suppliers } = useQuery<Array<{ id: string; name: string; qualityRating?: number }>>({
    queryKey: ["/api/suppliers"],
    enabled: open,
  });

  const [form, setForm] = useState({
    serviceProviderId: "",
    serviceProviderName: "",
    scope: "",
    estimatedCost: "",
    scheduledStartDate: "",
    notes: "",
  });

  const handleSubmit = async () => {
    try {
      await createMutation.mutateAsync({
        workOrderId,
        serviceProviderId: form.serviceProviderId || undefined,
        serviceProviderName: form.serviceProviderName || suppliers?.find((s) => s.id === form.serviceProviderId)?.name || undefined,
        scope: form.scope || undefined,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined,
        scheduledStartDate: form.scheduledStartDate || undefined,
        notes: form.notes || undefined,
        updateWorkOrderStatus: true,
      });
      toast({ title: "Service order created", description: `Linked to ${workOrderNumber}` });
      onClose();
      setForm({ serviceProviderId: "", serviceProviderName: "", scope: "", estimatedCost: "", scheduledStartDate: "", notes: "" });
    } catch (err) {
      toast({
        title: "Failed to create service order",
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
            Create a service order linked to {workOrderNumber}. The work order status will be updated to "Awaiting Service."
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Service Provider</Label>
            <Select value={form.serviceProviderId} onValueChange={(v) => setForm((p) => ({ ...p, serviceProviderId: v }))}>
              <SelectTrigger data-testid="select-so-provider"><SelectValue placeholder="Select provider..." /></SelectTrigger>
              <SelectContent>
                {suppliers?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      {s.name}
                      {s.qualityRating != null && <span className="text-[10px] text-muted-foreground">★{s.qualityRating.toFixed(1)}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Scope of Work</Label>
            <Textarea
              value={form.scope}
              onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}
              placeholder="Describe the external service needed..."
              rows={3}
              data-testid="input-so-scope"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Estimated Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={form.estimatedCost}
                onChange={(e) => setForm((p) => ({ ...p, estimatedCost: e.target.value }))}
                placeholder="0.00"
                data-testid="input-so-cost"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scheduled Start</Label>
              <Input
                type="date"
                value={form.scheduledStartDate}
                onChange={(e) => setForm((p) => ({ ...p, scheduledStartDate: e.target.value }))}
                data-testid="input-so-date"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes..."
              data-testid="input-so-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !form.scope || !form.serviceProviderId}
            data-testid="button-create-so-from-wo"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Service Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

interface LinkedServiceOrdersPanelProps {
  workOrderId: string;
  workOrderNumber: string;
  workOrderStatus?: string;
}

export function LinkedServiceOrdersPanel({
  workOrderId,
  workOrderNumber,
  workOrderStatus,
}: LinkedServiceOrdersPanelProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data, isLoading } = useWorkOrderServiceOrders(workOrderId);

  const serviceOrders = data?.serviceOrders || [];
  const hasActiveServiceOrders = serviceOrders.some(
    (so) => !["completed", "cancelled"].includes(so.status)
  );

  return (
    <div data-testid="linked-service-orders-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">External Service</h3>
          {serviceOrders.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{serviceOrders.length}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1"
          onClick={() => setCreateDialogOpen(true)}
          data-testid="button-request-service"
        >
          <Plus className="h-3 w-3" /> Request Service
        </Button>
      </div>

      {/* Status indicator when WO is awaiting service */}
      {(workOrderStatus === "awaiting_service" || hasActiveServiceOrders) && (
        <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 mb-3" data-testid="awaiting-service-banner">
          This work order is awaiting external service completion.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : serviceOrders.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-xs border rounded-lg" data-testid="no-linked-sos">
          No external service orders linked.
          <br />
          <span className="text-[11px]">Click "Request Service" to engage a vendor.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {serviceOrders.map((so) => (
            <div
              key={so.id}
              className="p-3 rounded-lg border hover:bg-accent/30 transition-colors"
              data-testid={`linked-so-${so.id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{so.soNumber}</span>
                  <Badge variant={soStatusVariant(so.status)} className="text-[10px]">
                    {soStatusLabel(so.status)}
                  </Badge>
                </div>
                <Link href={`/service-orders?id=${so.id}`} className="text-xs text-primary hover:underline flex items-center gap-1" data-testid={`link-so-${so.id}`}>
                  Open <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {so.serviceProviderName && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" /> {so.serviceProviderName}
                </div>
              )}

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {so.scheduledStartDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(so.scheduledStartDate).toLocaleDateString()}
                  </span>
                )}
                {so.estimatedCost != null && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${Number(so.estimatedCost).toLocaleString()}
                  </span>
                )}
              </div>

              {so.scope && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{so.scope}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateSOFromWODialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        workOrderId={workOrderId}
        workOrderNumber={workOrderNumber}
      />
    </div>
  );
}
