import { Wifi, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function TelemetryCoverageCard({
  coverage,
  isLoading,
}: {
  coverage?: {
    onlineCount: number;
    totalCount: number;
    delayedCount: number;
    delayedEquipment: Array<{
      equipmentId: string;
      equipmentName: string;
      vesselName: string;
      lastSeenAgo: string;
    }>;
  };
  isLoading: boolean;
}) {
  if (isLoading || !coverage) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Telemetry Coverage
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Telemetry Coverage
          </span>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm">Online:</span>
          <span className="font-bold" data-testid="telemetry-coverage">
            {coverage.onlineCount} / {coverage.totalCount}
          </span>
        </div>

        {coverage.delayedCount > 0 && (
          <>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Delayed:</span>
              <span className="font-bold text-yellow-600 dark:text-yellow-400">
                {coverage.delayedCount}
              </span>
            </div>
            <div className="space-y-1 pl-6">
              {coverage.delayedEquipment.slice(0, 3).map((eq) => (
                <div key={eq.equipmentId} className="text-xs flex items-center gap-2">
                  <span className="text-muted-foreground">-</span>
                  <span className="truncate flex-1">{eq.vesselName}</span>
                  <span className="text-muted-foreground shrink-0">
                    Last seen: {eq.lastSeenAgo}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <Button variant="outline" size="sm" className="w-full mt-2">
          Ingestion Health <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
