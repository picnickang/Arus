import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/patterns/ErrorState";
import { usePdmEquipmentDetailData } from "../hooks/usePdmEquipmentDetailData";
import { OverviewTab } from "./pdm-detail/OverviewTab";
import { SensorsTab } from "./pdm-detail/SensorsTab";
import { AnomaliesTab } from "./pdm-detail/AnomaliesTab";
import { MaintenanceTab } from "./pdm-detail/MaintenanceTab";

export type PdmDetailTab = "overview" | "sensors" | "anomalies" | "maintenance";

interface PdmEquipmentDetailProps {
  /** Overrides the route param; the wrapper screens parse it from the URL. */
  equipmentId?: string;
  defaultTab?: PdmDetailTab;
}

const STALE_MS = 24 * 60 * 60 * 1000;

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="min-w-[64px]">
      <div className="text-base font-bold capitalize" data-testid={testId}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function HealthHeader({
  name,
  type,
  healthScore,
  healthStatus,
  rul,
  confidence,
  lastUpdated,
  isLoading,
}: {
  name: string;
  type?: string | undefined;
  healthScore: number;
  healthStatus: string;
  rul: number | null;
  confidence: string;
  lastUpdated?: string | undefined;
  isLoading: boolean;
}) {
  const lastUpdatedDate = lastUpdated ? new Date(lastUpdated) : null;
  const ageMs = lastUpdatedDate ? Date.now() - lastUpdatedDate.getTime() : null;
  // status "unknown" means no ML score exists, so healthScore is the default.
  const noMlScore = healthStatus === "unknown";
  const isStale = (ageMs != null && ageMs > STALE_MS) || noMlScore;

  let rulDisplay = "…";
  if (!isLoading) {
    rulDisplay = rul != null ? `${rul}d` : "—";
  }

  return (
    <Card data-testid="pdm-health-header">
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold" data-testid="pdm-equipment-name">
              {name}
            </h2>
            {type ? <p className="text-sm text-muted-foreground">{type}</p> : null}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat
              label="Health"
              value={isLoading ? "…" : `${Math.round(healthScore)}%`}
              testId="stat-health"
            />
            <Stat label="Status" value={isLoading ? "…" : healthStatus} testId="stat-status" />
            <Stat label="RUL" value={rulDisplay} testId="stat-rul" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {lastUpdatedDate ? (
            <span data-testid="health-freshness">
              Health computed {formatDistanceToNow(lastUpdatedDate, { addSuffix: true })}
            </span>
          ) : (
            <span data-testid="health-freshness">Health score not yet computed</span>
          )}
          <span>· confidence {confidence}</span>
          {isStale ? (
            <Badge
              variant="outline"
              className="border-amber-400 text-amber-600"
              data-testid="health-stale-warning"
            >
              <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
              {noMlScore ? "No recent ML score — showing default" : "Stale (>24h)"}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Live PdM equipment detail: a health header (with score-freshness signal) over
 * four tabs — Overview (multi-sensor telemetry), Sensors, Anomalies, Maintenance.
 * Wired to the prepared usePdmEquipmentDetailData hooks; the equipmentId comes
 * from the route param (or an explicit prop from the mobile-readiness wrappers).
 */
export function PdmEquipmentDetail({
  equipmentId,
  defaultTab = "overview",
}: PdmEquipmentDetailProps) {
  const {
    equipmentId: resolvedId,
    equipment,
    healthData,
    isLoadingEquipment,
    equipmentError,
    handleBack,
    retryEquipment,
    healthScore,
    healthStatus,
    rul,
    confidence,
  } = usePdmEquipmentDetailData(equipmentId);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4" data-testid="pdm-equipment-detail">
      {equipmentError ? (
        <ErrorState
          error={equipmentError}
          title="Failed to load equipment"
          variant="page"
          onRetry={retryEquipment}
          onBack={handleBack}
        />
      ) : (
        <>
          <HealthHeader
            name={equipment?.name ?? resolvedId}
            type={equipment?.type}
            healthScore={healthScore}
            healthStatus={healthStatus}
            rul={rul}
            confidence={confidence}
            lastUpdated={healthData?.lastUpdated}
            isLoading={isLoadingEquipment}
          />
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview" data-testid="tab-overview">
                Overview
              </TabsTrigger>
              <TabsTrigger value="sensors" data-testid="tab-sensors">
                Sensors
              </TabsTrigger>
              <TabsTrigger value="anomalies" data-testid="tab-anomalies">
                Anomalies
              </TabsTrigger>
              <TabsTrigger value="maintenance" data-testid="tab-maintenance">
                Maintenance
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <OverviewTab equipmentId={resolvedId} healthData={healthData} />
            </TabsContent>
            <TabsContent value="sensors">
              <SensorsTab equipmentId={resolvedId} />
            </TabsContent>
            <TabsContent value="anomalies">
              <AnomaliesTab equipmentId={resolvedId} />
            </TabsContent>
            <TabsContent value="maintenance">
              <MaintenanceTab equipmentId={resolvedId} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
