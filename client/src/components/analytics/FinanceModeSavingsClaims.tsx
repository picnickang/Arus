import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

export interface SavingsRecord {
  id: string;
  workOrderId: string | null;
  equipmentId: string;
  maintenanceType: string;
  totalSavings: number;
  validationStatus: string;
  validationReason: string | null;
  validationChangedBy: string | null;
  validationChangedAt: string | null;
  calculatedAt: string;
}

function ValidationStatusBadge({ status }: { status: string }) {
  if (status === "valid") {
    return (
      <Badge
        variant="outline"
        className="border-green-500 text-green-600"
        data-testid={`badge-status-${status}`}
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        Valid
      </Badge>
    );
  }

  if (status === "disputed") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500 text-amber-600"
        data-testid={`badge-status-${status}`}
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        Disputed
      </Badge>
    );
  }

  if (status === "voided") {
    return (
      <Badge
        variant="outline"
        className="border-red-500 text-red-600"
        data-testid={`badge-status-${status}`}
      >
        <XCircle className="h-3 w-3 mr-1" />
        Voided
      </Badge>
    );
  }

  return <Badge variant="outline">{status}</Badge>;
}

function SavingsClaimActions({
  savingsId,
  currentStatus,
}: {
  savingsId: string;
  currentStatus: string;
}) {
  const [showForm, setShowForm] = useState<"disputed" | "voided" | null>(null);
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason: string }) => {
      return apiRequest("PATCH", `/api/cost-savings/${savingsId}/validation`, {
        validationStatus: status,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-savings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-savings/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-savings/trend"] });
      toast({
        title: "Validation status updated",
        description: `Savings claim has been ${showForm === "disputed" ? "disputed" : "voided"}.`,
      });
      setShowForm(null);
      setReason("");
    },
    onError: () => {
      toast({
        title: "Failed to update",
        description: "Could not update the validation status.",
        variant: "destructive",
      });
    },
  });

  if (currentStatus === "voided") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {!showForm && (
        <div className="flex gap-2">
          {currentStatus === "valid" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                onClick={() => setShowForm("disputed")}
                data-testid={`button-dispute-${savingsId}`}
              >
                Dispute
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => setShowForm("voided")}
                data-testid={`button-void-${savingsId}`}
              >
                Void
              </Button>
            </>
          )}
          {currentStatus === "disputed" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={() => {
                  setShowForm("disputed");
                  setReason("");
                }}
                data-testid={`button-revalidate-${savingsId}`}
              >
                Re-validate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => setShowForm("voided")}
                data-testid={`button-void-${savingsId}`}
              >
                Void
              </Button>
            </>
          )}
        </div>
      )}
      {showForm && (
        <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium">
            {showForm === "disputed"
              ? currentStatus === "disputed"
                ? "Re-validate this claim"
                : "Dispute this savings claim"
              : "Void this savings claim"}
          </p>
          <Textarea
            placeholder="Enter reason..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="text-sm"
            data-testid={`input-reason-${savingsId}`}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!reason.trim() || mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  status:
                    currentStatus === "disputed" && showForm === "disputed" ? "valid" : showForm,
                  reason,
                })
              }
              data-testid={`button-confirm-${savingsId}`}
            >
              {mutation.isPending ? "Updating..." : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(null);
                setReason("");
              }}
              data-testid={`button-cancel-${savingsId}`}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SavingsClaimsSection({ savingsRecords }: { savingsRecords: SavingsRecord[] }) {
  return (
    <CollapsibleSection title="Savings Claims" summary={`${savingsRecords.length} savings records`}>
      {savingsRecords.length === 0 ? (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="text-no-savings-claims"
        >
          No savings claims recorded yet
        </p>
      ) : (
        <div className="space-y-3" data-testid="savings-claims-list">
          {savingsRecords.map((record) => (
            <div
              key={record.id}
              className="p-4 border rounded-lg"
              data-testid={`savings-claim-${record.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-medium text-sm"
                      data-testid={`text-savings-amount-${record.id}`}
                    >
                      ${((record.totalSavings ?? 0) / 1000).toFixed(1)}k savings
                    </span>
                    <ValidationStatusBadge status={record.validationStatus ?? "valid"} />
                    <Badge variant="secondary" className="text-xs">
                      {record.maintenanceType}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-x-3">
                    {record.workOrderId && <span>WO: {record.workOrderId.slice(0, 8)}...</span>}
                    <span>Equipment: {record.equipmentId?.slice(0, 8)}...</span>
                    {record.calculatedAt && (
                      <span>{formatDate(new Date(record.calculatedAt))}</span>
                    )}
                  </div>
                  {record.validationReason && (
                    <p
                      className="text-xs text-muted-foreground italic mt-1"
                      data-testid={`text-validation-reason-${record.id}`}
                    >
                      Reason: {record.validationReason}
                    </p>
                  )}
                  {record.validationChangedBy && record.validationChangedAt && (
                    <p className="text-xs text-muted-foreground">
                      Changed by {record.validationChangedBy} on{" "}
                      {formatDate(new Date(record.validationChangedAt))}
                    </p>
                  )}
                </div>
                <SavingsClaimActions
                  savingsId={record.id}
                  currentStatus={record.validationStatus ?? "valid"}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
