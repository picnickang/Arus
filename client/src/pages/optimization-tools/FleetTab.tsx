import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Loader2, Ship, Users, Wrench, Zap } from "lucide-react";

interface FleetStats {
  activeVessels: number;
  totalVessels: number;
  activeCrew: number;
  totalCrew: number;
}

type OptimizationData = ReturnType<typeof import("@/features/maintenance").useOptimizationData>;

export function FleetTab({ o, fleetStats }: { o: OptimizationData; fleetStats: FleetStats }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Fleet Optimization
          </CardTitle>
          <CardDescription>
            Fleet-wide resource allocation and scheduling coordination
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ship className="h-4 w-4" />
                  <span className="text-sm font-medium">Active Vessels</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-active-vessels">
                  {fleetStats.activeVessels}
                </p>
                <p className="text-xs text-muted-foreground">of {fleetStats.totalVessels} total</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Active Crew</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-active-crew">
                  {fleetStats.activeCrew}
                </p>
                <p className="text-xs text-muted-foreground">of {fleetStats.totalCrew} total</p>
              </Card>
            </div>
            <Separator />
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => o.fleetOptimizationMutation.mutate(undefined)}
                disabled={o.fleetOptimizationMutation.isPending || !o.configurations?.length}
                data-testid="button-fleet-optimization"
              >
                {o.fleetOptimizationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Run Fleet Optimization
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => o.crewSchedulingMutation.mutate(undefined)}
                disabled={o.crewSchedulingMutation.isPending}
                data-testid="button-crew-scheduling"
              >
                {o.crewSchedulingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Optimize Crew Scheduling
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => o.maintenanceSchedulingMutation.mutate(undefined)}
                disabled={o.maintenanceSchedulingMutation.isPending}
                data-testid="button-maintenance-scheduling"
              >
                {o.maintenanceSchedulingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wrench className="h-4 w-4 mr-2" />
                )}
                Schedule Maintenance
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Fleet Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vessel Utilization</span>
                <span>
                  {fleetStats.totalVessels > 0
                    ? Math.round((fleetStats.activeVessels / fleetStats.totalVessels) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={
                  fleetStats.totalVessels > 0
                    ? (fleetStats.activeVessels / fleetStats.totalVessels) * 100
                    : 0
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Crew Availability</span>
                <span>
                  {fleetStats.totalCrew > 0
                    ? Math.round((fleetStats.activeCrew / fleetStats.totalCrew) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={
                  fleetStats.totalCrew > 0
                    ? (fleetStats.activeCrew / fleetStats.totalCrew) * 100
                    : 0
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Equipment Tracked</span>
                <span>{(o.equipment as Array<{ id: string }> | undefined)?.length ?? 0} items</span>
              </div>
              <Progress value={100} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600" data-testid="text-total-savings">
                  {o.formatCurrency(
                    o.optimizationResults?.reduce(
                      (sum: number, r: { costSavings?: number | null }) =>
                        sum + (r.costSavings || 0),
                      0
                    ) ?? 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Total Savings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600" data-testid="text-completed-runs">
                  {o.optimizationResults?.filter(
                    (r: { runStatus?: string }) => r.runStatus === "completed"
                  ).length ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Completed Runs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
