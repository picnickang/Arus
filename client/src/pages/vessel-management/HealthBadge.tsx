import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Heart } from "lucide-react";
import type { EquipmentHealth } from "./types";

export function HealthBadge({ health }: { health?: EquipmentHealth | undefined }) {
  if (!health) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Activity className="h-3 w-3 mr-1" />
        No data
      </Badge>
    );
  }
  const healthIndex = (health['healthIndex'] as number | undefined) ?? 0;
  const status = health.status;
  if (status === "critical" || healthIndex < 30) {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {healthIndex}%
      </Badge>
    );
  }
  if (status === "warning" || healthIndex < 70) {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100">
        <Activity className="h-3 w-3 mr-1" />
        {healthIndex}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
      <Heart className="h-3 w-3 mr-1" />
      {healthIndex}%
    </Badge>
  );
}
