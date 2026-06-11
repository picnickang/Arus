import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLatestFeatures, useComputeFeatures } from "@/features/pdm/hooks/use-feature-store";
import { EquipmentSelector } from "@/components/shared/EquipmentSelector";
import { useEquipmentName } from "@/hooks/use-equipment-lookup";
import { EquipmentLink, TimestampBadge } from "./_shared";

export function FeatureStoreTab() {
  const [equipmentId, setEquipmentId] = useState("");
  const { data: features, isLoading, refetch } = useLatestFeatures(equipmentId);
  const computeMutation = useComputeFeatures();
  const { toast } = useToast();
  const equipmentName = useEquipmentName(equipmentId);

  const handleCompute = async () => {
    if (!equipmentId) {
      return;
    }
    try {
      await computeMutation.mutateAsync({ equipmentId });
      toast({ title: "Features computed successfully" });
      refetch();
    } catch {
      toast({ title: "Failed to compute features", variant: "destructive" });
    }
  };

  const hasFeatures = !!features && !features.message;
  const sampleCount = hasFeatures ? (features?.sampleCount ?? 0) : 0;
  const dataSource = sampleCount > 0 ? "telemetry" : "stub";

  const featureEntries = hasFeatures
    ? [
        { name: "Mean Temperature", value: features.meanTemp, unit: "°C" },
        { name: "Std Temperature", value: features.stdTemp, unit: "°C" },
        { name: "Mean Vibration", value: features.meanVibration, unit: "mm/s" },
        { name: "Std Vibration", value: features.stdVibration, unit: "mm/s" },
        { name: "Mean Pressure", value: features.meanPressure, unit: "bar" },
        { name: "Std Pressure", value: features.stdPressure, unit: "bar" },
        { name: "RMS Vibration", value: features.rmsVibration, unit: "mm/s" },
        { name: "Peak-to-Peak", value: features.peakToPeak, unit: "mm/s" },
        { name: "Kurtosis", value: features.kurtosis, unit: "" },
        { name: "Skewness", value: features.skewness, unit: "" },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-72">
          <EquipmentSelector
            value={equipmentId}
            onValueChange={setEquipmentId}
            placeholder="Select equipment"
            data-testid="input-equipment-id-features"
          />
        </div>
        <Button
          data-testid="button-compute-features"
          onClick={handleCompute}
          disabled={!equipmentId || computeMutation.isPending}
        >
          {computeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Compute Features
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading features...
        </div>
      )}

      {featureEntries.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle
                  data-testid="text-features-title"
                  className="text-lg flex items-center gap-2"
                >
                  Features: <EquipmentLink equipmentId={equipmentId} />
                </CardTitle>
                <CardDescription className="flex items-center gap-3">
                  <span>
                    Window: {features?.windowMinutes ?? 60} min | Samples: {sampleCount}
                  </span>
                  <TimestampBadge
                    label="Computed"
                    {...((features?.computedAt || features?.createdAt) !== undefined && {
                      timestamp: features?.computedAt || features?.createdAt,
                    })}
                  />
                </CardDescription>
              </div>
              <Badge
                data-testid="badge-data-source"
                variant={dataSource === "telemetry" ? "default" : "secondary"}
              >
                {dataSource === "telemetry" ? "Live Telemetry" : "Estimated"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {featureEntries.map((f) => (
                <div key={f.name} className="p-3 rounded-lg border bg-muted/50">
                  <div className="text-xs text-muted-foreground">{f.name}</div>
                  <div
                    className="text-lg font-semibold"
                    data-testid={`text-feature-${f.name.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    {f.value != null ? Number(f.value).toFixed(2) : "—"}{" "}
                    <span className="text-xs text-muted-foreground">{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {equipmentId && !isLoading && featureEntries.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No features computed yet for {equipmentName}. Click "Compute Features" to start.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
