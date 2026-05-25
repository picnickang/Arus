import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  ExternalLink,
  Plus,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useWorkOrderServiceOrders,
  type LinkedServiceOrder,
} from "@/features/work-orders/hooks/useWoSoBridge";
import {
  useWorkOrderServiceRequests,
  useCreateServiceRequest,
} from "@/features/serviceRequests/hooks/useServiceRequests";
import { SRStatusBadge } from "@/features/serviceRequests/components/SRStatusBadge";
import { SRPriorityBadge } from "@/features/serviceRequests/components/SRPriorityBadge";
import type { ServiceRequest } from "@/features/serviceRequests/types";
import { cn } from "@/lib/utils";

function soStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "in_progress":
      return "secondary";
    case "cancelled":
      return "destructive";
    case "draft":
    case "sent":
    case "confirmed":
      return "outline";
    default:
      return "outline";
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

const TIMELINE_STEPS = [
  { key: "created", label: "Created" },
  { key: "sent", label: "Sent" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
] as const;

function getTimelineIndex(status: string): number {
  const map: Record<string, number> = {
    draft: 0,
    sent: 1,
    confirmed: 2,
    in_progress: 3,
    completed: 4,
  };
  return map[status] ?? -1;
}

function getTimestampForStep(so: LinkedServiceOrder, stepKey: string): string | null {
  switch (stepKey) {
    case "created":
      return so.createdAt;
    case "sent":
      return so.sentAt;
    case "confirmed":
      return so.confirmedAt;
    case "completed":
      return so.completedAt;
    default:
      return null;
  }
}

function MiniTimeline({ so }: { so: LinkedServiceOrder }) {
  const currentIdx = getTimelineIndex(so.status);
  const isCancelled = so.status === "cancelled";

  if (isCancelled) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-destructive"
        data-testid={`timeline-cancelled-${so.id}`}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>Cancelled{so.cancellationReason ? `: ${so.cancellationReason}` : ""}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 mt-2" data-testid={`timeline-${so.id}`}>
      <div className="flex items-center gap-0.5">
        {TIMELINE_STEPS.map((step, i) => {
          const isDone = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const ts = getTimestampForStep(so, step.key);
          return (
            <div key={step.key} className="flex items-center gap-0.5">
              <div
                className={cn(
                  "h-2 w-2 rounded-full border transition-colors",
                  isDone
                    ? isCurrent
                      ? "bg-primary border-primary"
                      : "bg-primary/60 border-primary/60"
                    : "bg-muted border-muted-foreground/30"
                )}
                title={ts ? `${step.label}: ${new Date(ts).toLocaleDateString()}` : step.label}
              />
              {i < TIMELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-3 transition-colors",
                    i < currentIdx ? "bg-primary/60" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-1.5">
          {TIMELINE_STEPS[currentIdx]?.label || so.status}
        </span>
      </div>
      {(so.sentAt || so.confirmedAt || so.completedAt) && (
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {so.sentAt && (
            <span>
              Sent:{" "}
              {new Date(so.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {so.confirmedAt && (
            <span>
              Confirmed:{" "}
              {new Date(so.confirmedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {so.completedAt && (
            <span>
              Completed:{" "}
              {new Date(so.completedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function OnTrackIndicator({ so }: { so: LinkedServiceOrder }) {
  if (so.status === "completed" || so.status === "cancelled" || so.status === "draft") {
    return null;
  }
  const scheduledEnd = so.scheduledEndDate ? new Date(so.scheduledEndDate) : null;
  if (!scheduledEnd) {
    return null;
  }

  const now = new Date();
  const daysLeft = Math.ceil((scheduledEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = now > scheduledEnd;

  if (isOverdue) {
    return (
      <div
        className="flex items-center gap-1 text-[10px] text-destructive font-medium"
        data-testid={`indicator-overdue-${so.id}`}
      >
        <AlertTriangle className="h-3 w-3" /> {Math.abs(daysLeft)}d overdue
      </div>
    );
  }
  if (daysLeft <= 3) {
    return (
      <div
        className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium"
        data-testid={`indicator-due-soon-${so.id}`}
      >
        <Clock className="h-3 w-3" /> {daysLeft}d left
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400"
      data-testid={`indicator-on-track-${so.id}`}
    >
      <CheckCircle2 className="h-3 w-3" /> On track
    </div>
  );
}

function CostVariance({ so }: { so: LinkedServiceOrder }) {
  const quoted = so.quotedAmount;
  const actual = so.actualAmount;
  const currency = so.currency || "USD";
  if (quoted == null && actual == null) {
    return null;
  }

  const fmt = (v: number) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
    } catch {
      return `$${v.toLocaleString()}`;
    }
  };

  if (actual != null && quoted != null && quoted > 0) {
    const variance = actual - quoted;
    const pct = ((variance / quoted) * 100).toFixed(1);
    const isOver = variance > 0;
    return (
      <div className="space-y-0.5" data-testid={`cost-variance-${so.id}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Quoted: {fmt(quoted)}</span>
          <span>Actual: {fmt(actual)}</span>
        </div>
        {variance !== 0 && (
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium",
              isOver ? "text-destructive" : "text-green-600 dark:text-green-400"
            )}
          >
            {isOver ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isOver ? "+" : ""}
            {fmt(variance)} ({isOver ? "+" : ""}
            {pct}%)
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {quoted != null && <span>Quoted: {fmt(quoted)}</span>}
      {actual != null && <span>Actual: {fmt(actual)}</span>}
    </div>
  );
}

function DateRange({
  label,
  start,
  end,
}: {
  label: string;
  start: string | null;
  end: string | null;
}) {
  if (!start && !end) {
    return null;
  }
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="h-3 w-3 flex-shrink-0" />
      <span className="font-medium">{label}:</span>
      {start && <span>{fmtDate(start)}</span>}
      {start && end && <span>-</span>}
      {end && <span>{fmtDate(end)}</span>}
    </div>
  );
}

function ServiceRequestCard({ sr }: { sr: ServiceRequest }) {
  return (
    <div
      className="p-3 rounded-lg border border-dashed hover:bg-accent/30 transition-colors space-y-1.5"
      data-testid={`linked-sr-${sr.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{sr.requestNumber}</span>
          <SRStatusBadge status={sr.status} />
          <SRPriorityBadge priority={sr.urgency} />
        </div>
        {sr.serviceOrderId && (
          <Link
            href={`/service-orders?id=${sr.serviceOrderId}`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
            data-testid={`link-sr-so-${sr.id}`}
          >
            <ArrowRight className="h-3 w-3" /> View SO
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-1">{sr.title}</p>
      {sr.rejectionReason && (
        <p className="text-xs text-destructive line-clamp-1">Rejected: {sr.rejectionReason}</p>
      )}
      <div className="text-[10px] text-muted-foreground">
        Requested by {sr.requestedBy} on {new Date(sr.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

function CreateServiceRequestDialog({
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
  const { data: soData, isLoading: soLoading } = useWorkOrderServiceOrders(workOrderId);
  const { data: srData, isLoading: srLoading } = useWorkOrderServiceRequests(workOrderId);

  const serviceOrders = soData?.serviceOrders || [];
  const serviceRequests = srData?.serviceRequests || [];
  const hasActiveServiceOrders = serviceOrders.some(
    (so) => !["completed", "cancelled"].includes(so.status)
  );
  const hasPendingRequests = serviceRequests.some((sr) =>
    ["pending_review", "under_review", "approved"].includes(sr.status)
  );
  const isLoading = soLoading || srLoading;

  return (
    <div data-testid="linked-service-orders-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">External Service</h3>
          {(serviceOrders.length > 0 || serviceRequests.length > 0) && (
            <Badge variant="outline" className="text-[10px]">
              {serviceRequests.length > 0 && `${serviceRequests.length} req`}
              {serviceRequests.length > 0 && serviceOrders.length > 0 && " / "}
              {serviceOrders.length > 0 && `${serviceOrders.length} SO`}
            </Badge>
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

      {(workOrderStatus === "awaiting_service" || hasActiveServiceOrders || hasPendingRequests) && (
        <div
          className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 mb-3"
          data-testid="awaiting-service-banner"
        >
          {hasPendingRequests && !hasActiveServiceOrders
            ? "Service request submitted — awaiting procurement review."
            : "This work order is awaiting external service completion."}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : serviceRequests.length === 0 && serviceOrders.length === 0 ? (
        <div
          className="text-center py-4 text-muted-foreground text-xs border rounded-lg"
          data-testid="no-linked-sos"
        >
          No service requests or orders linked.
          <br />
          <span className="text-[11px]">
            Click "Request Service" to submit a request to procurement.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {serviceRequests.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Service Requests
              </div>
              {serviceRequests.map((sr) => (
                <ServiceRequestCard key={sr.id} sr={sr} />
              ))}
            </div>
          )}

          {serviceOrders.length > 0 && (
            <div className="space-y-2">
              {serviceRequests.length > 0 && (
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-3">
                  Service Orders
                </div>
              )}
              {serviceOrders.map((so) => (
                <div
                  key={so.id}
                  className="p-3 rounded-lg border hover:bg-accent/30 transition-colors space-y-2"
                  data-testid={`linked-so-${so.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{so.soNumber}</span>
                      <Badge variant={soStatusVariant(so.status)} className="text-[10px]">
                        {soStatusLabel(so.status)}
                      </Badge>
                      <OnTrackIndicator so={so} />
                    </div>
                    <Link
                      href={`/service-orders?id=${so.id}`}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      data-testid={`link-so-${so.id}`}
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {so.createdAt && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created {new Date(so.createdAt).toLocaleDateString()}
                    </div>
                  )}

                  {so.serviceProviderName && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      {so.supplierProfileId ? (
                        <Link
                          href={`/inventory-management?tab=purchasing&supplier=${so.supplierProfileId}`}
                          className="text-primary hover:underline"
                          data-testid={`link-supplier-${so.id}`}
                        >
                          {so.serviceProviderName}
                        </Link>
                      ) : (
                        so.serviceProviderName
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <DateRange
                      label="Scheduled"
                      start={so.scheduledStartDate}
                      end={so.scheduledEndDate}
                    />
                    {(so.actualStartDate || so.actualEndDate) && (
                      <DateRange label="Actual" start={so.actualStartDate} end={so.actualEndDate} />
                    )}
                  </div>

                  <CostVariance so={so} />

                  {so.scope && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{so.scope}</p>
                  )}

                  {so.serviceDetails && (
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid={`so-service-details-${so.id}`}
                    >
                      <span className="font-medium">Details:</span> {so.serviceDetails}
                    </div>
                  )}

                  {so.specialRequirements && (
                    <div
                      className="text-xs text-amber-600 dark:text-amber-400"
                      data-testid={`so-special-req-${so.id}`}
                    >
                      <span className="font-medium">Special Requirements:</span>{" "}
                      {so.specialRequirements}
                    </div>
                  )}

                  {so.revisionNotes && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 border-l-2 border-amber-400 pl-2">
                      <span className="font-medium">Revision:</span> {so.revisionNotes}
                    </div>
                  )}

                  {(so.estimatedDurationHours != null || so.actualDurationHours != null) && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {so.estimatedDurationHours != null && (
                        <span>Est. Duration: {so.estimatedDurationHours}h</span>
                      )}
                      {so.actualDurationHours != null && (
                        <span>Actual: {so.actualDurationHours}h</span>
                      )}
                      {so.estimatedDurationHours != null && so.actualDurationHours != null && (
                        <span
                          className={
                            so.actualDurationHours > so.estimatedDurationHours
                              ? "text-destructive"
                              : "text-green-600 dark:text-green-400"
                          }
                        >
                          ({so.actualDurationHours > so.estimatedDurationHours ? "+" : ""}
                          {(so.actualDurationHours - so.estimatedDurationHours).toFixed(1)}h)
                        </span>
                      )}
                    </div>
                  )}

                  <MiniTimeline so={so} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <CreateServiceRequestDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        workOrderId={workOrderId}
        workOrderNumber={workOrderNumber}
      />
    </div>
  );
}
