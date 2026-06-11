import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useTwinResiduals,
  useResidualRankings,
  useComputeResiduals,
} from "@/features/digital-twin/hooks/useTwinApi";

import { severityColor } from "./utils";

interface ResidualRow {
  id?: string;
  sensorType?: string;
  observed?: number;
  expected?: number;
  residual?: number;
  zScore?: number;
  severity?: string;
}

interface ResidualRanking {
  twinId?: string;
  sensorType?: string;
  avgZScore?: number;
  severity?: string;
}

export function ResidualsTab() {
  const [twinId, setTwinId] = useState("");
  const { data: residualsData, isLoading } = useTwinResiduals(twinId);
  const residuals = (residualsData as ResidualRow[] | undefined) ?? [];
  const { data: rankingsData, isLoading: rankingsLoading } = useResidualRankings();
  const rankings = (rankingsData as ResidualRanking[] | undefined) ?? [];
  const computeMutation = useComputeResiduals();
  const { toast } = useToast();

  const handleCompute = async () => {
    if (!twinId) {
      return;
    }
    try {
      await computeMutation.mutateAsync(twinId);
      toast({ title: "Residuals computed" });
    } catch (e: unknown) {
      toast({
        title: (e instanceof Error && e.message) || "Failed",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="input-twin-id-residuals"
          type="text"
          placeholder="Enter twin ID"
          value={twinId}
          onChange={(e) => setTwinId(e.target.value)}
          className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button
          data-testid="button-compute-residuals"
          onClick={handleCompute}
          disabled={!twinId || computeMutation.isPending}
        >
          {computeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <BarChart3 className="w-4 h-4 mr-2" />
          )}
          Compute Residuals
        </Button>
      </div>

      {twinId && isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {residuals.length > 0 && (
        <Card data-testid="card-residuals-table">
          <CardHeader>
            <CardTitle className="text-base">Residuals for Twin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Sensor</th>
                    <th className="pb-2 font-medium text-right">Observed</th>
                    <th className="pb-2 font-medium text-right">Expected</th>
                    <th className="pb-2 font-medium text-right">Residual</th>
                    <th className="pb-2 font-medium text-right">Z-Score</th>
                    <th className="pb-2 font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {residuals.map((r, i) => (
                    <tr key={r.id || i} className="border-b" data-testid={`row-residual-${i}`}>
                      <td className="py-2 capitalize">{r.sensorType?.replace(/_/g, " ")}</td>
                      <td className="py-2 text-right font-mono">{r.observed?.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono">{r.expected?.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono">{r.residual?.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono">{r.zScore?.toFixed(2)}</td>
                      <td className="py-2">
                        <Badge
                          variant={
                            severityColor(r.severity ?? "") as
                              | "default"
                              | "secondary"
                              | "destructive"
                              | "outline"
                          }
                          data-testid={`badge-severity-${i}`}
                        >
                          {r.severity}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">Residual Rankings (All Twins)</h3>
        {rankingsLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : rankings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rankings.map((r, i) => (
              <Card key={i} data-testid={`card-ranking-${i}`}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium capitalize">{r.sensorType?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        Twin: {r.twinId?.slice(0, 8)}...
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">Avg Z: {r.avgZScore?.toFixed(2)}</p>
                      <Badge
                        variant={
                          severityColor(r.severity ?? "") as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline"
                        }
                      >
                        {r.severity}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="text-no-rankings">
            No rankings available yet.
          </p>
        )}
      </div>
    </div>
  );
}
