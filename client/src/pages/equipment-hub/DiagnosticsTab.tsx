import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, Play } from "lucide-react";
import type { EquipmentHubData } from "@/hooks/useEquipmentHub";

export function DiagnosticsTab({
  data,
  runDiagnostic,
  isDiagnosticPending,
}: {
  data: EquipmentHubData;
  runDiagnostic: (analysisType: string) => void;
  isDiagnosticPending: boolean;
}) {
  return (
    <Card className="bg-white/[0.02] border-slate-700/15" data-testid="diagnostics-section">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Diagnostics
        </CardTitle>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="text-[11px] h-7"
            onClick={() => runDiagnostic("bearing")}
            disabled={isDiagnosticPending}
            data-testid="button-run-bearing"
          >
            <Play className="h-3 w-3 mr-1" /> Bearing Analysis
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-[11px] h-7"
            onClick={() => runDiagnostic("pump")}
            disabled={isDiagnosticPending}
            data-testid="button-run-pump"
          >
            <Play className="h-3 w-3 mr-1" /> Pump Analysis
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-[11px] h-7"
            onClick={() => runDiagnostic("general")}
            disabled={isDiagnosticPending}
            data-testid="button-run-general"
          >
            <Play className="h-3 w-3 mr-1" /> General
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isDiagnosticPending && (
          <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running analysis...
          </div>
        )}
        {data.diagnosticRuns.length > 0 ? (
          <div className="space-y-1.5">
            {data.diagnosticRuns.map((diag) => (
              <div
                key={diag.id}
                className="px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8"
                data-testid={`diagnostic-run-${diag.id}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-slate-200 capitalize">
                    {diag.analysisType} Analysis
                  </span>
                  <span className="text-[10px] text-slate-500">{diag.createdAt}</span>
                </div>
                {diag.summary && (
                  <p className="text-[11px] text-slate-400 leading-relaxed">{diag.summary}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 py-3 text-center">
            No diagnostic history. Run an analysis above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
