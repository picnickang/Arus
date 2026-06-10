import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EquipmentHubData } from "@/hooks/useEquipmentHub";
import { riskBg, riskColor, SeverityDot } from "./shared";

/** Default tab: the AI assessment, open items and decision evidence. */
export function OverviewTab({ data }: { data: EquipmentHubData }) {
  return (
    <div className="space-y-5">
      <Card className="bg-white/[0.02] border-slate-700/15" data-testid="assessment-section">
        <CardContent className="p-4">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
            AI Assessment
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-3" data-testid="assessment-text">
            {data.assessment}
          </p>
          <div className={`p-3 rounded-lg border text-xs ${riskBg(data.risk)}`}>
            <span className={`font-semibold ${riskColor(data.risk)}`}>Recommended Action:</span>
            <span className="text-slate-400 ml-1" data-testid="recommended-action">
              {data.recommendedAction}
            </span>
          </div>
          <div className="flex gap-4 mt-3 text-[11px] text-slate-500">
            <div>
              <span className="text-slate-600">Last Service:</span> {data.lastService || "No data"}
            </div>
            <div>
              <span className="text-slate-600">Next Due:</span> {data.nextDue || "Not scheduled"}
            </div>
          </div>
        </CardContent>
      </Card>

      {data.needsAction.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" data-testid="needs-action-strip">
          {data.needsAction.map((item) => (
            <Link key={item.id} href={item.link}>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border whitespace-nowrap text-xs cursor-pointer transition-colors ${item.urgency === "high" ? "bg-red-500/5 border-red-500/15 text-red-400 hover:bg-red-500/10" : item.urgency === "medium" ? "bg-yellow-500/5 border-yellow-500/15 text-yellow-400 hover:bg-yellow-500/10" : "bg-slate-500/5 border-slate-500/15 text-slate-400 hover:bg-slate-500/10"}`}
                data-testid={`needs-action-${item.id}`}
              >
                <SeverityDot severity={item.urgency} />
                {item.title}
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {data.signals.length > 0 && (
        <Card className="bg-white/[0.02] border-slate-700/15" data-testid="evidence-section">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-600 uppercase tracking-wider">
              Evidence & Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.signals.map((sig, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8 text-xs text-slate-400 flex items-center gap-2"
                data-testid={`signal-${i}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${data.risk === "critical" ? "bg-red-500" : data.risk === "warning" ? "bg-yellow-500" : "bg-green-500"}`}
                />
                {sig}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
