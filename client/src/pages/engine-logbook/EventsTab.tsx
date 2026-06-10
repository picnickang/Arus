import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "lucide-react";
import { type EngineLogbookHookReturn, type EngineLogEvent } from "@/features/engine-logbook";
import { EngineEventItem } from "@/components/engine-logbook/row-components";

export function EventsTab({ e }: { e: EngineLogbookHookReturn }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Engine Room Events Timeline
        </CardTitle>
        <CardDescription>Automated and manual event log entries</CardDescription>
      </CardHeader>
      <CardContent>
        {e.loadingEvents ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : e.events && e.events.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {[...e.events]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((event: EngineLogEvent) => (
                  <EngineEventItem key={event.id} event={event} />
                ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mb-4 opacity-50" />
            <p>No events recorded for this day</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
