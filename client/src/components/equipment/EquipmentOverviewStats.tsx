import { Card, CardContent } from "@/components/ui/card";
import {
  Server,
  CheckCircle,
  AlertTriangle,
  Ship,
  AlertCircle as AlertCircleIcon,
} from "lucide-react";

interface EquipmentStats {
  total: number;
  active: number;
  inactive: number;
  vesselCount: number;
  unassigned: number;
  filtered: number;
}

interface EquipmentOverviewStatsProps {
  stats: EquipmentStats;
}

export function EquipmentOverviewStats({ stats }: EquipmentOverviewStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5" data-testid="equipment-stats">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Equipment</p>
              <p className="text-2xl font-bold" data-testid="stat-total">
                {stats.total}
              </p>
            </div>
            <Server className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600" data-testid="stat-active">
                {stats.active}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold text-muted-foreground" data-testid="stat-inactive">
                {stats.inactive}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Vessels</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="stat-vessels">
                {stats.vesselCount}
              </p>
            </div>
            <Ship className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Unassigned</p>
              <p className="text-2xl font-bold text-orange-600" data-testid="stat-unassigned">
                {stats.unassigned}
              </p>
            </div>
            <AlertCircleIcon className="h-8 w-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
