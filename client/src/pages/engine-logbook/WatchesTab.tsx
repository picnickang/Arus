import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { WATCH_PERIODS, type EngineLogbookHookReturn } from "@/features/engine-logbook";
import { EngineWatchCard } from "@/components/engine-logbook/row-components";

export function WatchesTab({ e }: { e: EngineLogbookHookReturn }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Engine Room Watch Assignments
        </CardTitle>
        <CardDescription>Record engineering watch personnel for each period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {WATCH_PERIODS.map((period) => (
            <EngineWatchCard
              key={period}
              period={period}
              watch={e.watchAssignments.get(period) ?? {}}
              isLocked={e.isLocked}
              updateWatchAssignment={e.updateWatchAssignment}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
