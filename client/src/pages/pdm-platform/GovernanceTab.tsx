import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Eye, CheckCheck, XCircle, Wrench, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  usePredictionGovernance,
  useGovernanceDetail,
  useReviewPrediction,
  useApprovePrediction,
  useSuppressPrediction,
} from "@/features/pdm/hooks/usePredictionGovernance";
import { EquipmentLink } from "./_shared";

const statusBadgeVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "approved") {
    return "default";
  }
  if (status === "suppressed") {
    return "destructive";
  }
  if (status === "expired") {
    return "outline";
  }
  if (status === "reviewed") {
    return "secondary";
  }
  return "secondary";
};

const riskBadgeVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
  if (level === "critical") {
    return "destructive";
  }
  if (level === "high") {
    return "secondary";
  }
  return "default";
};

export function GovernanceTab({
  onSwitchToModels,
}: {
  onSwitchToModels: (modelId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPredictionId, setSelectedPredictionId] = useState<number | null>(null);
  const [suppressDialogOpen, setSuppressDialogOpen] = useState(false);
  const [suppressTargetId, setSuppressTargetId] = useState<number | null>(null);
  const [suppressReason, setSuppressReason] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const queryStatus = statusFilter === "all" ? undefined : statusFilter;
  const { data: predictions, isLoading } = usePredictionGovernance(queryStatus);
  const { data: detail } = useGovernanceDetail(selectedPredictionId);
  const reviewMutation = useReviewPrediction();
  const approveMutation = useApprovePrediction();
  const suppressMutation = useSuppressPrediction();

  const handleReview = async (id: number) => {
    try {
      await reviewMutation.mutateAsync({ id });
      toast({ title: "Prediction marked as reviewed" });
    } catch {
      toast({ title: "Failed to review prediction", variant: "destructive" });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveMutation.mutateAsync({ id });
      toast({ title: "Prediction approved" });
    } catch {
      toast({ title: "Failed to approve prediction", variant: "destructive" });
    }
  };

  const handleSuppressOpen = (id: number) => {
    setSuppressTargetId(id);
    setSuppressReason("");
    setSuppressDialogOpen(true);
  };

  const handleSuppressConfirm = async () => {
    if (!suppressTargetId || !suppressReason.trim()) {
      return;
    }
    try {
      await suppressMutation.mutateAsync({ id: suppressTargetId, reason: suppressReason });
      toast({ title: "Prediction suppressed" });
      setSuppressDialogOpen(false);
      setSuppressTargetId(null);
      setSuppressReason("");
    } catch {
      toast({ title: "Failed to suppress prediction", variant: "destructive" });
    }
  };

  const predictionsList = Array.isArray(predictions) ? predictions : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          data-testid="select-governance-status"
        >
          <SelectTrigger className="w-48" data-testid="select-trigger-governance-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="select-item-all">
              All Statuses
            </SelectItem>
            <SelectItem value="pending" data-testid="select-item-pending">
              Pending
            </SelectItem>
            <SelectItem value="reviewed" data-testid="select-item-reviewed">
              Reviewed
            </SelectItem>
            <SelectItem value="approved" data-testid="select-item-approved">
              Approved
            </SelectItem>
            <SelectItem value="suppressed" data-testid="select-item-suppressed">
              Suppressed
            </SelectItem>
            <SelectItem value="expired" data-testid="select-item-expired">
              Expired
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground" data-testid="text-governance-count">
          {predictionsList.length} prediction{predictionsList.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading governance predictions...
        </div>
      )}

      {!isLoading && predictionsList.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No predictions found for the selected filter.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {predictionsList.map((p: any) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-colors ${selectedPredictionId === p.id ? "ring-2 ring-primary" : ""}`}
            onClick={() => setSelectedPredictionId(p.id)}
            data-testid={`card-governance-prediction-${p.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EquipmentLink equipmentId={p.equipmentId} />
                    <Badge
                      variant={riskBadgeVariant(p.riskLevel)}
                      data-testid={`badge-risk-${p.id}`}
                    >
                      {p.riskLevel}
                    </Badge>
                    <Badge
                      variant={statusBadgeVariant(p.reviewStatus || "pending")}
                      data-testid={`badge-status-${p.id}`}
                    >
                      {p.reviewStatus || "pending"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4 flex-wrap">
                    <span>Probability: {((p.failureProbability ?? 0) * 100).toFixed(1)}%</span>
                    {p.remainingUsefulLife != null && <span>RUL: {p.remainingUsefulLife}d</span>}
                    {p.predictionValidUntil && (
                      <span>
                        Valid until: {new Date(p.predictionValidUntil).toLocaleDateString()}
                      </span>
                    )}
                    {p.modelVersionId && (
                      <button
                        className="text-primary hover:underline inline-flex items-center gap-1"
                        data-testid={`link-model-${p.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwitchToModels(p.modelVersionId);
                        }}
                      >
                        Model: {p.modelVersionId.slice(0, 8)}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    {p.featureSetVersion && <span>Features: {p.featureSetVersion}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(!p.reviewStatus || p.reviewStatus === "pending") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReview(p.id);
                      }}
                      disabled={reviewMutation.isPending}
                      data-testid={`button-review-${p.id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" /> Review
                    </Button>
                  )}
                  {(p.reviewStatus === "pending" || p.reviewStatus === "reviewed") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(p.id);
                      }}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-${p.id}`}
                    >
                      <CheckCheck className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  )}
                  {p.reviewStatus !== "suppressed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSuppressOpen(p.id);
                      }}
                      data-testid={`button-suppress-${p.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Suppress
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-create-wo-governance-${p.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/work-orders?action=create&equipmentId=${p.equipmentId}`);
                    }}
                  >
                    <Wrench className="w-4 h-4 mr-1" /> Work Order
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPredictionId && detail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Prediction Detail: <EquipmentLink equipmentId={detail.equipmentId} />
            </CardTitle>
            <CardDescription>Full provenance and audit trail</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Risk Level</div>
                <Badge
                  variant={riskBadgeVariant(detail.riskLevel)}
                  data-testid="text-provenance-risk"
                >
                  {detail.riskLevel}
                </Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Review Status</div>
                <Badge
                  variant={statusBadgeVariant(detail.reviewStatus || "pending")}
                  data-testid="text-provenance-status"
                >
                  {detail.reviewStatus || "pending"}
                </Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Failure Probability</div>
                <div className="font-medium">
                  {((detail.failureProbability ?? 0) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">RUL</div>
                <div className="font-medium">
                  {detail.remainingUsefulLife != null
                    ? `${detail.remainingUsefulLife} days`
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Prediction Date</div>
                <div className="font-medium">
                  {detail.predictionTimestamp
                    ? new Date(detail.predictionTimestamp).toLocaleString()
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Valid Until</div>
                <div className="font-medium" data-testid="text-provenance-valid-until">
                  {detail.predictionValidUntil
                    ? new Date(detail.predictionValidUntil).toLocaleString()
                    : "No expiry"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Model Version</div>
                <div className="font-medium" data-testid="text-provenance-model-version">
                  {detail.modelVersionId ? (
                    <button
                      data-testid="link-detail-model-version"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      onClick={() => onSwitchToModels(detail.modelVersionId ?? "")}
                    >
                      {detail.modelVersionId.slice(0, 12)}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : (
                    "N/A"
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Feature Set Version</div>
                <div className="font-medium" data-testid="text-provenance-feature-set">
                  {detail.featureSetVersion || "N/A"}
                </div>
              </div>
              {detail.reviewedBy && (
                <div>
                  <div className="text-muted-foreground">Reviewed By</div>
                  <div className="font-medium">{detail.reviewedBy}</div>
                </div>
              )}
              {detail.reviewedAt && (
                <div>
                  <div className="text-muted-foreground">Reviewed At</div>
                  <div className="font-medium">{new Date(detail.reviewedAt).toLocaleString()}</div>
                </div>
              )}
              {detail.suppressionReason && (
                <div className="col-span-2 md:col-span-3">
                  <div className="text-muted-foreground">Suppression Reason</div>
                  <div className="font-medium">{detail.suppressionReason}</div>
                </div>
              )}
            </div>
            {detail.equipmentId && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="default"
                  data-testid="button-create-wo-detail"
                  onClick={() =>
                    navigate(`/work-orders?action=create&equipmentId=${detail.equipmentId}`)
                  }
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Create Work Order
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={suppressDialogOpen} onOpenChange={setSuppressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suppress Prediction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Provide a reason for suppressing prediction #{suppressTargetId}. This action will mark
              the prediction as suppressed and remove it from active monitoring.
            </div>
            <Textarea
              data-testid="input-suppress-reason"
              placeholder="Enter suppression reason..."
              value={suppressReason}
              onChange={(e) => setSuppressReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuppressDialogOpen(false)}
              data-testid="button-suppress-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSuppressConfirm}
              disabled={!suppressReason.trim() || suppressMutation.isPending}
              data-testid="button-suppress-confirm"
            >
              {suppressMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Suppress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
