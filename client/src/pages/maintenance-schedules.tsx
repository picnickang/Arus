import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMaintenanceSchedulesData } from "@/features/maintenance";
import { MaintenanceScheduleDialogs } from "./maintenance-schedules-dialogs";
import { MaintenanceScheduleSections } from "./maintenance-schedules-sections";

export default function MaintenanceSchedules() {
  const m = useMaintenanceSchedulesData();

  if (m.isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-64"></div>
        <div className="h-48 bg-muted animate-pulse rounded"></div>
        <div className="h-96 bg-muted animate-pulse rounded"></div>
      </div>
    );
  }

  if (m.error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive mb-4">
              <AlertCircle className="h-5 w-5" />
              <div className="font-medium">Failed to load maintenance schedules</div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {m.error instanceof Error ? m.error.message : "Unknown error"}
            </p>
            <Button
              variant="outline"
              onClick={() => globalThis.location.reload()}
              data-testid="button-retry-maintenance"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MaintenanceScheduleSections m={m} />
      <MaintenanceScheduleDialogs m={m} />
    </div>
  );
}
