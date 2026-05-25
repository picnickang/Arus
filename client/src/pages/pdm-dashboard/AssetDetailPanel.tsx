import { FileText, Settings, AlertTriangle, Ship } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useAssetDetail,
  useCreateWorkOrderFromRisk,
  useEquipmentTelemetry,
} from "@/features/pdm";
import type { RiskQueueItem } from "@/features/pdm";
import { SeverityBadge, EvidenceChipBadge } from "./_shared";
import { RulGauge } from "./RulGauge";
import { EvidenceTimeSeriesChart } from "./EvidenceTimeSeriesChart";
import { RecommendedActionsChecklist } from "./RecommendedActionsChecklist";

interface FleetFailurePatternItem {
  failureId: number | string;
  failureTimestamp: string;
  failureMode: string;
  failureSeverity: string | null;
  rootCause: string | null;
  workOrderId: string | null;
  workOrderNumber: string | null;
  equipmentId: string;
  equipmentName: string;
  vesselId: string | null;
  vesselName: string | null;
}

interface FleetFailurePatternResponse {
  equipmentId: string;
  equipmentType: string;
  vesselId: string | null;
  items: FleetFailurePatternItem[];
  total: number;
}

function FleetFailurePatternPanel({ equipmentId }: { equipmentId: string }) {
  const url = `/api/pdm/equipment/${equipmentId}/fleet-failure-pattern?limit=10`;
  const { data, isLoading, isError } = useQuery<FleetFailurePatternResponse>({
    queryKey: [url],
    enabled: !!equipmentId,
    staleTime: 60_000,
  });

  return (
    <div data-testid="fleet-failure-pattern-panel">
      <p className="text-sm font-medium mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Fleet failure pattern
      </p>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <p
          className="text-sm text-muted-foreground p-3 border border-dashed rounded-md"
          data-testid="text-fleet-failure-error"
        >
          Unable to load cross-vessel failure history right now.
        </p>
      ) : !data || data.items.length === 0 ? (
        <p
          className="text-sm text-muted-foreground p-3 border border-dashed rounded-md"
          data-testid="text-fleet-failure-empty"
        >
          No failures recorded on this equipment type on other vessels.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="list-fleet-failures">
          {data.items.map((item) => {
            const date = item.failureTimestamp
              ? format(new Date(item.failureTimestamp), "MMM d, yyyy")
              : "—";
            const row = (
              <div
                className="p-3 border rounded-md hover:bg-muted/50 transition-colors"
                data-testid={`row-fleet-failure-${item.failureId}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                    <span data-testid={`text-vessel-${item.failureId}`}>
                      {item.vesselName || "Unknown vessel"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{date}</span>
                </div>
                <p
                  className="text-xs text-muted-foreground mt-1"
                  data-testid={`text-failure-mode-${item.failureId}`}
                >
                  {item.failureMode}
                  {item.failureSeverity ? ` · ${item.failureSeverity}` : ""}
                </p>
                {item.workOrderNumber && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.workOrderNumber}
                  </p>
                )}
              </div>
            );
            return (
              <li key={String(item.failureId)}>
                {item.workOrderId ? (
                  <Link
                    href={`/work-orders?id=${item.workOrderId}`}
                    data-testid={`link-fleet-failure-wo-${item.failureId}`}
                  >
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AssetDetailPanel({
  item,
  onClose,
}: {
  item: RiskQueueItem | null;
  onClose: () => void;
}) {
  const { data: assetDetail, isLoading } = useAssetDetail(item?.equipmentId || null);
  const { data: telemetryReadings, isLoading: telemetryLoading } = useEquipmentTelemetry(
    item?.equipmentId || null,
    { limit: 50, hours: 24 }
  );
  const createWOMutation = useCreateWorkOrderFromRisk();

  if (!item) {
    return null;
  }

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {item.vesselName} | {item.equipmentName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={item.severity} />
            <Badge variant="outline">{item.equipmentType}</Badge>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2 text-center">RUL Estimate</p>
            <RulGauge
              rulDays={item.rulEstimateDays}
              confidence={item.confidence}
              {...(item.rulConfidenceInterval !== undefined && { confidenceInterval: item.rulConfidenceInterval })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <p className="text-xs text-muted-foreground">Failure Mode</p>
              <p className="font-medium text-sm mt-1">{item.failureMode}</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="font-bold text-lg">{item.confidence}%</p>
            </div>
          </div>

          {item.evidenceChips && item.evidenceChips.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Evidence</p>
              <div className="flex flex-wrap gap-2">
                {item.evidenceChips.map((chip, idx) => (
                  <EvidenceChipBadge key={idx} chip={chip} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Telemetry History</p>
            <EvidenceTimeSeriesChart
              {...(telemetryReadings !== undefined && { readings: telemetryReadings })}
              isLoading={telemetryLoading}
              failureMode={item.failureMode}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            assetDetail?.recommendedActions && (
              <RecommendedActionsChecklist actions={assetDetail.recommendedActions} />
            )
          )}

          {item.equipmentId && <FleetFailurePatternPanel equipmentId={item.equipmentId} /> }

          <div className="pt-4 border-t space-y-2">
            <Button
              className="w-full"
              onClick={() => createWOMutation.mutate(item.id)}
              disabled={createWOMutation.isPending || item.status === "resolved"}
              data-testid="detail-create-wo"
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Work Order
            </Button>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
