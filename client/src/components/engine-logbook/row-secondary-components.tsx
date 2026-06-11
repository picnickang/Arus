import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { getEngineEventTypeConfig, type EngineLogEvent } from "@/features/engine-logbook";

export interface WatchData {
  chiefEngineerName?: string;
  secondEngineerName?: string;
  thirdEngineerName?: string;
  motormanName?: string;
}

export function EngineEventItem({ event }: { event: EngineLogEvent }) {
  const config = getEngineEventTypeConfig(event.eventType);
  const Icon = config.icon;
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
      data-testid={`event-${event.id}`}
    >
      <div className={`p-2 rounded-full ${config.color} text-white`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{config.label}</span>
          <Badge variant="outline" className="text-xs">
            {event.source}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{event.summary}</p>
        {event.details && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{event.details}</p>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(event.timestamp), "HH:mm")}
      </div>
    </div>
  );
}

export function EngineWatchCard({
  period,
  watch,
  isLocked,
  updateWatchAssignment,
}: {
  period: string;
  watch: WatchData;
  isLocked: boolean;
  updateWatchAssignment: (period: string, field: string, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Watch {period}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Chief Engineer</Label>
          <Input
            value={watch.chiefEngineerName ?? ""}
            onChange={(ev) => updateWatchAssignment(period, "chiefEngineerName", ev.target.value)}
            placeholder="Name"
            disabled={isLocked}
            data-testid={`input-watch-${period}-chief`}
          />
        </div>
        <div>
          <Label>Second Engineer</Label>
          <Input
            value={watch.secondEngineerName ?? ""}
            onChange={(ev) => updateWatchAssignment(period, "secondEngineerName", ev.target.value)}
            placeholder="Name"
            disabled={isLocked}
            data-testid={`input-watch-${period}-second`}
          />
        </div>
        <div>
          <Label>Third Engineer</Label>
          <Input
            value={watch.thirdEngineerName ?? ""}
            onChange={(ev) => updateWatchAssignment(period, "thirdEngineerName", ev.target.value)}
            placeholder="Name"
            disabled={isLocked}
            data-testid={`input-watch-${period}-third`}
          />
        </div>
        <div>
          <Label>Motorman/Oiler</Label>
          <Input
            value={watch.motormanName ?? ""}
            onChange={(ev) => updateWatchAssignment(period, "motormanName", ev.target.value)}
            placeholder="Name"
            disabled={isLocked}
            data-testid={`input-watch-${period}-motorman`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
