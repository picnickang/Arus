import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  Heart,
  Gauge,
  Timer,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useLatestTwinState,
  useComputeTwinState,
} from "@/features/digital-twin/hooks/useTwinApi";




import { healthColor } from "./utils";

export function StateTab() {
  const [twinId, setTwinId] = useState("");
  const { data: state, isLoading, error } = useLatestTwinState(twinId);
  const computeMutation = useComputeTwinState();
  const { toast } = useToast();

  const handleCompute = async () => {
    if (!twinId) {
      return;
    }
    try {
      await computeMutation.mutateAsync(twinId);
      toast({ title: "State computed successfully" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to compute state";
      toast({ title: message, variant: "destructive" });
    }
  };

  const observed = state?.observedValues as Record<string, number> | undefined;
  const expected = state?.expectedValues as Record<string, number> | undefined;
  const allSensors =
    observed && expected
      ? Array.from(new Set([...Object.keys(observed), ...Object.keys(expected)]))
      : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="input-twin-id-state"
          type="text"
          placeholder="Enter twin ID"
          value={twinId}
          onChange={(e) => setTwinId(e.target.value)}
          className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button
          data-testid="button-compute-state"
          onClick={handleCompute}
          disabled={!twinId || computeMutation.isPending}
        >
          {computeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Compute State
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {state && !state.error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-health-score">
              <CardContent className="pt-4 text-center">
                <Heart className={`w-8 h-8 mx-auto mb-2 ${healthColor(state.healthScore)}`} />
                <p className={`text-3xl font-bold ${healthColor(state.healthScore)}`}>
                  {state.healthScore?.toFixed(1) ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Health Score</p>
              </CardContent>
            </Card>
            <Card data-testid="card-efficiency-score">
              <CardContent className="pt-4 text-center">
                <Gauge className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <p className="text-3xl font-bold text-blue-600">
                  {state.efficiencyScore?.toFixed(1) ?? "—"}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">Efficiency Score</p>
              </CardContent>
            </Card>
            <Card data-testid="card-rul">
              <CardContent className="pt-4 text-center">
                <Timer className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="text-3xl font-bold text-purple-600">
                  {state.remainingUsefulLifeHours?.toFixed(0) ?? "—"}h
                </p>
                <p className="text-sm text-muted-foreground mt-1">Remaining Useful Life</p>
              </CardContent>
            </Card>
          </div>

          {allSensors.length > 0 && (
            <Card data-testid="card-metrics-table">
              <CardHeader>
                <CardTitle className="text-base">Expected vs Observed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Sensor</th>
                        <th className="pb-2 font-medium text-right">Expected</th>
                        <th className="pb-2 font-medium text-right">Observed</th>
                        <th className="pb-2 font-medium text-right">Deviation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSensors.map((sensor) => {
                        const obs = observed?.[sensor];
                        const exp = expected?.[sensor];
                        const dev =
                          obs != null && exp != null ? ((obs - exp) / (exp || 1)) * 100 : null;
                        return (
                          <tr
                            key={sensor}
                            className="border-b"
                            data-testid={`row-metric-${sensor}`}
                          >
                            <td className="py-2 capitalize">{sensor.replace(/_/g, " ")}</td>
                            <td className="py-2 text-right font-mono">{exp?.toFixed(2) ?? "—"}</td>
                            <td className="py-2 text-right font-mono">{obs?.toFixed(2) ?? "—"}</td>
                            <td className="py-2 text-right">
                              {dev != null ? (
                                <span
                                  className={
                                    Math.abs(dev) > 10
                                      ? "text-red-600"
                                      : Math.abs(dev) > 5
                                        ? "text-yellow-600"
                                        : "text-green-600"
                                  }
                                >
                                  {dev > 0 ? (
                                    <ArrowUp className="w-3 h-3 inline mr-1" />
                                  ) : dev < 0 ? (
                                    <ArrowDown className="w-3 h-3 inline mr-1" />
                                  ) : null}
                                  {dev.toFixed(1)}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && !isLoading && (
        <p className="text-sm text-muted-foreground" data-testid="text-no-state">
          No state data. Click "Compute State" to generate.
        </p>
      )}
    </div>
  );
}

