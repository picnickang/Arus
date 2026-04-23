import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Play,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useTwinScenarios,
  useRunScenario,
} from "@/features/digital-twin/hooks/useTwinApi";





export function ScenariosTab() {
  const [twinId, setTwinId] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [loadPercent, setLoadPercent] = useState(85);
  const [tempOffset, setTempOffset] = useState(0);
  const [maintDelay, setMaintDelay] = useState(0);
  const { data: scenarios, isLoading } = useTwinScenarios(twinId);
  const runMutation = useRunScenario();
  const { toast } = useToast();

  const handleRun = async () => {
    if (!twinId || !scenarioName) {
      return;
    }
    try {
      await runMutation.mutateAsync({
        twinId,
        name: scenarioName,
        parameters: {
          loadPercent,
          temperatureOffset: tempOffset,
          maintenanceDelayDays: maintDelay,
        },
      });
      toast({ title: "Scenario completed" });
    } catch (e: any) {
      toast({ title: e.message || "Failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card data-testid="card-scenario-form">
        <CardHeader>
          <CardTitle className="text-base">What-If Scenario</CardTitle>
          <CardDescription>
            Simulate the impact of changed conditions on twin health
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input
              data-testid="input-twin-id-scenario"
              type="text"
              placeholder="Twin ID"
              value={twinId}
              onChange={(e) => setTwinId(e.target.value)}
              className="flex h-10 w-60 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              data-testid="input-scenario-name"
              type="text"
              placeholder="Scenario name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">
                Load (%):{" "}
                <span className="font-mono" data-testid="text-load-value">
                  {loadPercent}
                </span>
              </label>
              <input
                data-testid="input-load-percent"
                type="range"
                min={0}
                max={120}
                value={loadPercent}
                onChange={(e) => setLoadPercent(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Temp Offset (°C):{" "}
                <span className="font-mono" data-testid="text-temp-value">
                  {tempOffset}
                </span>
              </label>
              <input
                data-testid="input-temp-offset"
                type="range"
                min={-50}
                max={50}
                value={tempOffset}
                onChange={(e) => setTempOffset(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Maintenance Delay (days):{" "}
                <span className="font-mono" data-testid="text-delay-value">
                  {maintDelay}
                </span>
              </label>
              <input
                data-testid="input-maint-delay"
                type="range"
                min={0}
                max={365}
                value={maintDelay}
                onChange={(e) => setMaintDelay(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          </div>

          <Button
            data-testid="button-run-scenario"
            onClick={handleRun}
            disabled={!twinId || !scenarioName || runMutation.isPending}
          >
            {runMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run Scenario
          </Button>
        </CardContent>
      </Card>

      {twinId && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Scenario History</h3>
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : scenarios?.length > 0 ? (
            <div className="space-y-3">
              {scenarios.map((s: any) => {
                const results = s.results as Record<string, any> | null;
                return (
                  <Card key={s.id} data-testid={`card-scenario-${s.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {results && (
                          <div className="text-right space-y-1">
                            {results.riskLevel && (
                              <Badge
                                variant={
                                  results.riskLevel === "critical"
                                    ? "destructive"
                                    : results.riskLevel === "high"
                                      ? "destructive"
                                      : "secondary"
                                }
                                data-testid={`badge-risk-${s.id}`}
                              >
                                {results.riskLevel}
                              </Badge>
                            )}
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {results.projectedHealth != null && (
                                <p>Health: {results.projectedHealth?.toFixed(1)}</p>
                              )}
                              {results.projectedRUL != null && (
                                <p>RUL: {results.projectedRUL?.toFixed(0)}h</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {results?.summary && (
                        <p className="text-sm mt-2 text-muted-foreground">{results.summary}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-no-scenarios">
              No scenarios run yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

