import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { format } from "date-fns";
import { getEventTypeConfig } from "@/features/deck-logbook";
import type { DeckEvent } from "./types";

export function EventTimelineItem({
  event,
  index,
  isLast,
}: {
  event: DeckEvent;
  index: number;
  isLast: boolean;
}) {
  const config = getEventTypeConfig(event.eventType);
  const Icon = config.icon;
  const formattedDetails =
    event.details && typeof event.details === "string" && event.details.startsWith("{")
      ? `${JSON.stringify(JSON.parse(event.details), null, 0).substring(0, 100)}...`
      : event.details;
  return (
    <div className="flex gap-4" data-testid={`event-item-${index}`}>
      <div className="flex flex-col items-center">
        <div
          className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {!isLast && <div className="w-0.5 h-full bg-border flex-1 mt-2" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-semibold">
            {format(new Date(event.timestamp), "HH:mm")}
          </span>
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {event.source}
          </Badge>
        </div>
        <p className="font-medium">{event.summary}</p>
        {event.positionLat && event.positionLon && (
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3" />
            {event.positionLat.toFixed(4)}° N, {event.positionLon.toFixed(4)}° E
          </p>
        )}
        {formattedDetails && (
          <p className="text-sm text-muted-foreground mt-1">{formattedDetails}</p>
        )}
      </div>
    </div>
  );
}
