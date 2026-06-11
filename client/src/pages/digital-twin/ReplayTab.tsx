import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
} from "lucide-react";
import {
  useTwinTimeline,
} from "@/features/digital-twin/hooks/useTwinApi";





export function ReplayTab() {
  const [twinId, setTwinId] = useState("");
  const [hours, setHours] = useState(24);

  const startTime = twinId
    ? new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    : undefined;
  const endTime = twinId ? new Date().toISOString() : undefined;

  const { data: timeline, isLoading } = useTwinTimeline(twinId, startTime, endTime);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="input-twin-id-replay"
          type="text"
          placeholder="Enter twin ID"
          value={twinId}
          onChange={(e) => setTwinId(e.target.value)}
          className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <select
          data-testid="select-replay-window"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value={1}>Last 1 hour</option>
          <option value={6}>Last 6 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {(timeline?.length ?? 0) > 0 ? (
        <Card data-testid="card-timeline">
          <CardHeader>
            <CardTitle className="text-base">Event Timeline ({timeline?.length ?? 0} events)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(timeline as Array<{
                id?: string;
                eventType?: string;
                type?: string;
                timestamp: string | number | Date;
                source?: string;
                description?: string;
                payload?: unknown;
              }>).map((evt, i) => (
                <div
                  key={evt.id || i}
                  className="flex items-start gap-3 border-l-2 pl-4 pb-3"
                  style={{
                    borderColor:
                      evt.eventType === "anomaly" || evt.type === "telemetry_anomaly"
                        ? "#ef4444"
                        : evt.eventType === "state_change"
                          ? "#3b82f6"
                          : "#d1d5db",
                  }}
                  data-testid={`event-${i}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {evt.eventType || evt.type || "event"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                      {evt.source && (
                        <span className="text-xs text-muted-foreground">via {evt.source}</span>
                      )}
                    </div>
                    {evt.payload != null && (
                      <pre className="text-xs mt-1 text-muted-foreground overflow-hidden text-ellipsis">
                        {typeof evt.payload === "string"
                          ? evt.payload
                          : (JSON.stringify(evt.payload, null, 2) ?? "").slice(0, 200)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : twinId && !isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-events">
          No events found in the selected time range.
        </p>
      ) : null}
    </div>
  );
}

