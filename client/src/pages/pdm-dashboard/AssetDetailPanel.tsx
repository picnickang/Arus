import { FileText, Settings } from "lucide-react";
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
              confidenceInterval={item.rulConfidenceInterval}
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
              readings={telemetryReadings}
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
