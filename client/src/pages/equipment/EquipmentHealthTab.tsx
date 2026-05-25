import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TabsContent } from "@/components/ui/tabs";
import { Activity, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EquipmentItem } from "./types";

export function EquipmentHealthTab({
  equipment,
  setLocation,
}: {
  equipment: EquipmentItem;
  setLocation: (path: string) => void;
}) {
  if (!equipment.health) {
    return (
      <TabsContent value="health" className="mt-4">
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No health data available</p>
          <p className="text-sm mt-1">Configure sensors to start monitoring</p>
        </div>
      </TabsContent>
    );
  }
  const healthIndex = (equipment.health['healthIndex'] as number | undefined) || 0;
  const predictedDueDays = equipment.health['predictedDueDays'] as number | undefined;
  const statusColor =
    equipment.health.status === "healthy"
      ? "text-green-600"
      : equipment.health.status === "warning"
        ? "text-yellow-600"
        : "text-red-600";
  const progressColor =
    healthIndex >= 70
      ? "[&>div]:bg-green-500"
      : healthIndex >= 30
        ? "[&>div]:bg-yellow-500"
        : "[&>div]:bg-red-500";
  return (
    <TabsContent value="health" className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Health Index</p>
            <p
              className={cn(
                "text-2xl font-bold",
                healthIndex >= 70
                  ? "text-green-600"
                  : healthIndex >= 30
                    ? "text-yellow-600"
                    : "text-red-600"
              )}
            >
              {healthIndex}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className={cn("text-2xl font-bold capitalize", statusColor)}>
              {equipment.health.status}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Health Progress</p>
            <span className="text-sm font-medium">{healthIndex}%</span>
          </div>
          <Progress value={healthIndex} className={cn("h-3", progressColor)} />
        </CardContent>
      </Card>
      {predictedDueDays !== undefined && (
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Predicted Maintenance</p>
            <p className="text-sm text-muted-foreground">
              In approximately {predictedDueDays} days
            </p>
          </div>
        </div>
      )}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setLocation(`/pdm/equipment/${equipment.id}`)}
      >
        <TrendingUp className="h-4 w-4 mr-2" />
        View Full Analytics
      </Button>
    </TabsContent>
  );
}
