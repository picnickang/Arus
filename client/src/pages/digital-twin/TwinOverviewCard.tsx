import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useEquipmentName, useEquipmentVesselName } from "@/hooks/use-equipment-lookup";
import {
  Loader2,
  BarChart3,
  Clock,
  RefreshCw,
  Heart,
  Gauge,
  Timer,
} from "lucide-react";
import {
  useLatestTwinState,
} from "@/features/digital-twin/hooks/useTwinApi";
import {
  type TwinFreshnessInfo,
} from "@/features/digital-twin/hooks/useTwinFreshness";


import { healthColor, formatTimeAgo } from "./utils";

export function TwinOverviewCard({
  twin,
  freshness,
  onRefresh,
  isRefreshing,
}: {
  twin: { id: string; name: string; equipmentId?: string | undefined; status?: string | undefined };
  freshness?: TwinFreshnessInfo | undefined;
  onRefresh: (twinId: string) => void | Promise<void>;
  isRefreshing: boolean;
}) {
  const { data: state } = useLatestTwinState(twin.id);
  const isStale = freshness?.isStale ?? true;
  const lastUpdated = freshness?.lastStateUpdate;
  const lastResidual = freshness?.lastResidualUpdate;
  const equipmentName = useEquipmentName(twin.equipmentId || "");
  const vesselName = useEquipmentVesselName(twin.equipmentId || "");

  return (
    <Card data-testid={`card-twin-${twin.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-1">
          <CardTitle className="text-base">{twin.name}</CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    <Badge
                      variant={isStale ? "destructive" : "default"}
                      data-testid={`badge-freshness-${twin.id}`}
                    >
                      {isStale ? "Stale" : "Fresh"}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {isStale
                    ? "State data is more than 24h old — click Refresh to update"
                    : "State data is up to date"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Badge
              variant={twin.status === "active" ? "default" : "secondary"}
              data-testid={`badge-twin-status-${twin.id}`}
            >
              {twin.status}
            </Badge>
          </div>
        </div>
        <CardDescription>
          {equipmentName}
          {vesselName ? ` — ${vesselName}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state && !state.error ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <Heart className={`w-4 h-4 mx-auto mb-1 ${healthColor(state.healthScore)}`} />
              <p
                className={`text-lg font-bold ${healthColor(state.healthScore)}`}
                data-testid={`text-health-${twin.id}`}
              >
                {state.healthScore?.toFixed(0) ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">Health</p>
            </div>
            <div>
              <Gauge className="w-4 h-4 mx-auto mb-1 text-blue-600" />
              <p
                className="text-lg font-bold text-blue-600"
                data-testid={`text-efficiency-${twin.id}`}
              >
                {state.efficiencyScore?.toFixed(0) ?? "—"}%
              </p>
              <p className="text-xs text-muted-foreground">Efficiency</p>
            </div>
            <div>
              <Timer className="w-4 h-4 mx-auto mb-1 text-purple-600" />
              <p className="text-lg font-bold text-purple-600" data-testid={`text-rul-${twin.id}`}>
                {state.remainingUsefulLifeHours?.toFixed(0) ?? "—"}h
              </p>
              <p className="text-xs text-muted-foreground">RUL</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No state computed yet</p>
        )}

        <div className="border-t pt-2 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              State: {formatTimeAgo(lastUpdated)}
            </span>
            <span data-testid={`text-last-updated-${twin.id}`}>
              {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              Residual: {formatTimeAgo(lastResidual)}
            </span>
            <span data-testid={`text-last-residual-${twin.id}`}>
              {lastResidual ? new Date(lastResidual).toLocaleTimeString() : "—"}
            </span>
          </div>
        </div>

        <Button
          data-testid={`button-refresh-twin-${twin.id}`}
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onRefresh(twin.id)}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1" />
          )}
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}

