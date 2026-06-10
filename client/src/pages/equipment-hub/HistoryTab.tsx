import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import type { EquipmentHubData } from "@/hooks/useEquipmentHub";
import { SeverityDot } from "./shared";

export function HistoryTab({ data }: { data: EquipmentHubData }) {
  return (
    <Card className="bg-white/[0.02] border-slate-700/15" data-testid="activity-timeline">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.activityTimeline.length > 0 ? (
          <div className="space-y-0">
            {data.activityTimeline.map((event, i) => (
              <div key={event.id} className="flex gap-3 py-2" data-testid={`timeline-event-${i}`}>
                <div className="flex flex-col items-center pt-0.5">
                  <SeverityDot severity={event.severity} />
                  {i < data.activityTimeline.length - 1 && (
                    <div className="w-px flex-1 bg-slate-700/30 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {event.title}
                    </span>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {new Date(event.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 py-3 text-center">No activity recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
