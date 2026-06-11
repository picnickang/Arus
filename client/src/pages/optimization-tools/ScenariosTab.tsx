import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Play, Settings, Trash2 } from "lucide-react";
import { formatPercent } from "@/lib/formatters";

type OptimizationData = ReturnType<typeof import("@/features/maintenance").useOptimizationData>;

export function ScenariosTab({ o }: { o: OptimizationData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Optimizer Configurations
        </CardTitle>
        <CardDescription>Manage optimization scenarios and algorithm parameters</CardDescription>
      </CardHeader>
      <CardContent>
        {o.configurationsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : o.filteredConfigurations.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground"
            data-testid="text-no-configurations"
          >
            No optimizer configurations found
          </div>
        ) : (
          <div className="space-y-4">
            {o.filteredConfigurations.map(
              (config: {
                id: string;
                name: string;
                enabled: boolean;
                algorithmType: string;
                maxSchedulingHorizon: number;
                costWeightFactor: number;
                conflictResolutionStrategy: string;
              }) => (
                <Card key={config.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3
                            className="font-semibold"
                            data-testid={`text-config-name-${config.id}`}
                          >
                            {config.name}
                          </h3>
                          {config.enabled ? (
                            <Badge className="bg-green-500 text-white">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Algorithm:</span>
                            <p
                              className="font-medium capitalize"
                              data-testid={`text-algorithm-${config.id}`}
                            >
                              {config.algorithmType}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Time Horizon:</span>
                            <p className="font-medium">{config.maxSchedulingHorizon} days</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cost Weight:</span>
                            <p className="font-medium">
                              {formatPercent(config.costWeightFactor * 100, 0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Strategy:</span>
                            <p className="font-medium">
                              {config.conflictResolutionStrategy.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            o.setSelectedConfiguration(config.id);
                            o.setRunDialogOpen(true);
                          }}
                          disabled={!config.enabled}
                          data-testid={`button-run-${config.id}`}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Run
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => o.deleteConfigMutation.mutate(config.id)}
                          data-testid={`button-delete-${config.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
