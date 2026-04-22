import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useFleetBaselines,
  useFleetComparison,
  useComputeBaselines,
} from "@/features/pdm/hooks/use-fleet-analytics";
import { EquipmentSelector } from "@/components/shared/EquipmentSelector";
import { useEquipmentVesselName } from "@/hooks/use-equipment-lookup";
import { EquipmentLink, useEquipmentTypes } from "./_shared";

export function FleetAnalyticsTab() {
  const [equipmentType, setEquipmentType] = useState("engine");
  const [equipmentId, setEquipmentId] = useState("");
  const { data: baselines, isLoading: baselinesLoading } = useFleetBaselines(equipmentType);
  const { data: comparison } = useFleetComparison(equipmentId, equipmentType);
  const computeMutation = useComputeBaselines();
  const { toast } = useToast();
  const equipmentTypes = useEquipmentTypes();
  const vesselName = useEquipmentVesselName(equipmentId);

  const statusColor = (status: string) =>
    status === "critical" ? "destructive" : status === "warning" ? "secondary" : "default";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-48">
          <Select value={equipmentType} onValueChange={setEquipmentType}>
            <SelectTrigger data-testid="input-equipment-type">
              <SelectValue placeholder="Equipment type" />
            </SelectTrigger>
            <SelectContent>
              {equipmentTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          data-testid="button-compute-baselines"
          onClick={() =>
            computeMutation
              .mutateAsync(equipmentType)
              .then(() => toast({ title: "Baselines computed from feature records" }))
              .catch(() => toast({ title: "Failed to compute baselines", variant: "destructive" }))
          }
          disabled={!equipmentType || computeMutation.isPending}
        >
          {computeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Compute Baselines
        </Button>
        <div className="w-72">
          <EquipmentSelector
            value={equipmentId}
            onValueChange={setEquipmentId}
            placeholder="Select equipment to compare"
            data-testid="input-equipment-id-compare"
          />
        </div>
      </div>

      {baselinesLoading && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading baselines...
        </div>
      )}

      {Array.isArray(baselines) && baselines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Fleet Baselines: {equipmentType.charAt(0).toUpperCase() + equipmentType.slice(1)}
            </CardTitle>
            <CardDescription>{baselines[0]?.sampleSize ?? 0} source records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Feature</th>
                    <th className="text-right p-2">Mean</th>
                    <th className="text-right p-2">Std Dev</th>
                    <th className="text-right p-2">P5</th>
                    <th className="text-right p-2">P95</th>
                    <th className="text-right p-2">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {baselines.map((b: any) => (
                    <tr
                      key={b.id}
                      className="border-b"
                      data-testid={`row-baseline-${b.featureName}`}
                    >
                      <td className="p-2 font-medium">{b.featureName}</td>
                      <td className="p-2 text-right">{b.mean?.toFixed(2)}</td>
                      <td className="p-2 text-right">{b.stddev?.toFixed(2)}</td>
                      <td className="p-2 text-right">{b.p5?.toFixed(2)}</td>
                      <td className="p-2 text-right">{b.p95?.toFixed(2)}</td>
                      <td className="p-2 text-right">{b.sampleSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {equipmentId && Array.isArray(comparison) && comparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Fleet Comparison: <EquipmentLink equipmentId={equipmentId} />
              {vesselName && (
                <span className="text-sm font-normal text-muted-foreground">— {vesselName}</span>
              )}
            </CardTitle>
            <CardDescription>
              Equipment vs fleet average with z-scores and percentiles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {comparison.map((c: any) => (
                <div
                  key={c.featureName}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`row-comparison-${c.featureName}`}
                >
                  <div className="font-medium w-32">{c.featureName}</div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="font-mono">{c.equipmentValue?.toFixed(2)}</span>
                    <span className="text-muted-foreground">
                      Fleet: {c.fleetMean?.toFixed(2)} ± {c.fleetStddev?.toFixed(2)}
                    </span>
                    <span className="font-mono">Z: {c.zScore?.toFixed(2)}</span>
                    <span className="text-muted-foreground">P{c.percentile?.toFixed(0)}</span>
                    <span className="flex items-center gap-1">
                      {c.aboveFleetAvg ? (
                        <ArrowUp className="w-3 h-3 text-orange-500" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-blue-500" />
                      )}
                      <span className="text-xs">{c.aboveFleetAvg ? "Above" : "Below"}</span>
                    </span>
                    <Badge variant={statusColor(c.status)}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
