import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeWindowPicker } from "@/features/telemetry";
import { useOverviewTabData, type PdmHealthData } from "../../hooks/usePdmEquipmentDetailData";
import { MultiSensorChart } from "./MultiSensorChart";

interface OverviewTabProps {
  equipmentId: string;
  healthData?: PdmHealthData | undefined;
}

type OverviewTimeRange = "1h" | "6h" | "24h" | "7d";

/**
 * PdM Overview tab: live multi-sensor telemetry over a selectable window.
 * The time window drives `useOverviewTabData`, which queries
 * GET /api/telemetry/history/:id/:sensorType?hours=N per sensor.
 */
export function OverviewTab({ equipmentId, healthData }: OverviewTabProps) {
  const { timeRange, setTimeRange, sensorData, baselines, isLoadingTelemetry, defaultSummary } =
    useOverviewTabData(equipmentId, healthData);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Sensor telemetry</h3>
        <TimeWindowPicker
          value={timeRange}
          onChange={(value) => setTimeRange(value as OverviewTimeRange)}
          data-testid="overview-time-window"
        />
      </div>

      <MultiSensorChart
        sensorData={sensorData}
        baselines={baselines}
        isLoading={isLoadingTelemetry}
      />

      {defaultSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground" data-testid="overview-ai-summary">
            {defaultSummary}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
