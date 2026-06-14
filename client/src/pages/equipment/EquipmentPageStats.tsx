import { Activity, AlertTriangle, CheckCircle, Heart, Plus, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PermissionGate } from "@/components/PermissionGate";
import { cn } from "@/lib/utils";
import type { EquipmentPageModel } from "./EquipmentPageTypes";

interface EquipmentPageStatsProps {
  m: EquipmentPageModel;
}

export function EquipmentPageStats({ m }: EquipmentPageStatsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipment Registry</h1>
        <PermissionGate resource="equipment" action="create">
          <Button onClick={() => m.setIsCreateDialogOpen(true)} data-testid="button-add-equipment">
            <Plus className="h-4 w-4 mr-2" />
            Add Equipment
          </Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{m.stats.total}</p>
              </div>
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Health</p>
                <p className="text-2xl font-bold">{m.stats.avgHealth}%</p>
              </div>
              <Heart
                className={cn(
                  "h-8 w-8",
                  m.stats.avgHealth >= 70
                    ? "text-green-500"
                    : m.stats.avgHealth >= 30
                      ? "text-yellow-500"
                      : "text-red-500"
                )}
              />
            </div>
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              m.setHealthFilter("healthy");
            }
          }}
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => m.setHealthFilter("healthy")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-2xl font-bold text-green-600">{m.stats.healthy}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              m.setHealthFilter("warning");
            }
          }}
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => m.setHealthFilter("warning")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warning</p>
                <p className="text-2xl font-bold text-yellow-600">{m.stats.warning}</p>
              </div>
              <Activity className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              m.setHealthFilter("critical");
            }
          }}
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => m.setHealthFilter("critical")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">{m.stats.critical}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
