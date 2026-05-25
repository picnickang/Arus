import { Wrench, Activity, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function MaintenancePipelineCard({
  pipeline,
  isLoading,
}: {
  pipeline?: {
    openWorkOrdersCount: number;
    awaitingApprovalCount: number;
    inProgressCount: number;
  } | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !pipeline) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance Pipeline
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
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Maintenance Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">Open Work Orders:</span>
          </div>
          <span className="font-bold" data-testid="open-wo">
            {pipeline.openWorkOrdersCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">Awaiting Approval:</span>
          </div>
          <span className="font-bold">{pipeline.awaitingApprovalCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-red-500" />
            <span className="text-sm">In Progress:</span>
          </div>
          <span className="font-bold">{pipeline.inProgressCount}</span>
        </div>

        <Button variant="outline" size="sm" className="w-full mt-2">
          View WOs <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
