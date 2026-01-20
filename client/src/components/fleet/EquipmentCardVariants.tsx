import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Ship, Clock, AlertTriangle, ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { EquipmentHealthData, StatusConfig } from "./EquipmentHealthCard";

export function getHealthColor(score: number): string {
  if (score >= 75) {return "text-green-600 dark:text-green-400";}
  if (score >= 50) {return "text-yellow-600 dark:text-yellow-400";}
  return "text-red-600 dark:text-red-400";
}

interface CardProps {
  equipment: EquipmentHealthData;
  config: StatusConfig;
  Icon: LucideIcon;
}

export function CompactCard({ equipment, config, Icon, onViewDetails, highlighted }: CardProps & { onViewDetails?: (id: string) => void; highlighted: boolean }) {
  return (
    <div className={cn("flex items-center justify-between p-4 rounded-lg transition-all duration-300", highlighted ? "bg-primary/20 border-2 border-primary shadow-lg" : config.bgLight)} data-testid={`equipment-card-${equipment.id}`}>
      <div className="flex items-center space-x-3 flex-1">
        <div className={cn("w-2 h-2 rounded-full", config.indicator)} />
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">{equipment.name || equipment.id}</p>
          <p className="text-sm text-muted-foreground">{equipment.type && <span className="mr-2">{equipment.type}</span>}{equipment.vesselName}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right space-y-1">
          <div className="flex items-center space-x-2">
            <Progress value={equipment.healthScore} className="w-20 h-2" />
            <span className={cn("text-sm font-medium", getHealthColor(equipment.healthScore))}>{equipment.healthScore}%</span>
          </div>
          {equipment.predictedDueDays !== undefined && <p className="text-xs text-muted-foreground">Due in {equipment.predictedDueDays} days</p>}
        </div>
        {onViewDetails && <Button variant="ghost" size="sm" onClick={() => onViewDetails(equipment.id)} data-testid={`button-view-${equipment.id}`}><ArrowRight className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
}

export function LightCard({ equipment, config, Icon, detailPath, onViewDetails, showVessel, highlighted }: CardProps & { detailPath: string; onViewDetails?: (id: string) => void; showVessel: boolean; highlighted: boolean }) {
  const content = (
    <Card className={cn("transition-all hover:shadow-md", highlighted && "ring-2 ring-primary shadow-lg", onViewDetails && "cursor-pointer")} onClick={() => onViewDetails?.(equipment.id)} data-testid={`equipment-card-${equipment.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2"><div className={cn("w-3 h-3 rounded-full", config.indicator)} /><Icon className="h-5 w-5 text-muted-foreground" /></div>
          <Badge variant={config.badgeVariant} className="text-xs">{config.label}</Badge>
        </div>
        <h3 className="font-semibold text-foreground truncate mb-1">{equipment.name}</h3>
        {showVessel && equipment.vesselName && <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><Ship className="h-3 w-3" />{equipment.vesselName}</p>}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Health</span><span className={cn("font-medium", getHealthColor(equipment.healthScore))}>{equipment.healthScore}%</span></div>
            <Progress value={equipment.healthScore} className="h-1.5" />
          </div>
          {equipment.rul !== null && equipment.rul !== undefined && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />RUL: {equipment.rul} days</div>}
          {equipment.pFail30d !== undefined && equipment.pFail30d > 0.1 && <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400"><AlertTriangle className="h-3 w-3" />{(equipment.pFail30d * 100).toFixed(0)}% failure risk (30d)</div>}
        </div>
      </CardContent>
    </Card>
  );
  return onViewDetails ? content : <Link href={detailPath}>{content}</Link>;
}

export function DarkCard({ equipment, config, Icon, detailPath, showVessel, showTelemetry }: CardProps & { detailPath: string; showVessel: boolean; showTelemetry: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={detailPath}>
            <div className={cn("p-4 rounded-lg border-2 transition-all hover:scale-[1.02] cursor-pointer", config.bgDark)} data-testid={`equipment-card-${equipment.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2"><div className={cn("w-3 h-3 rounded-full", config.indicator)} /><Icon className="h-5 w-5 text-slate-300" /></div>
                <Badge variant={config.badgeVariant} className="text-xs">{config.label.toUpperCase()}</Badge>
              </div>
              <h3 className="font-semibold text-white truncate mb-1">{equipment.name}</h3>
              {showVessel && equipment.vesselName && <p className="text-xs text-slate-400 mb-3 flex items-center gap-1"><Ship className="h-3 w-3" />{equipment.vesselName}</p>}
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Health</span><span className="text-white font-medium">{equipment.healthScore}%</span></div>
                  <Progress value={equipment.healthScore} className="h-1.5 bg-slate-700" />
                </div>
                {equipment.rul !== null && equipment.rul !== undefined && <div className="flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" />RUL: {equipment.rul} days</div>}
                {equipment.pFail30d !== undefined && equipment.pFail30d > 0.1 && <div className="flex items-center gap-1 text-xs text-orange-400"><AlertTriangle className="h-3 w-3" />{(equipment.pFail30d * 100).toFixed(0)}% failure risk (30d)</div>}
                {showTelemetry && equipment.telemetry && equipment.telemetry.length > 0 && (
                  <div className="pt-2 border-t border-slate-700 mt-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {equipment.telemetry.slice(0, 4).map((t) => <div key={`${t.sensorType}-${t.timestamp}`} className="flex justify-between"><span className="text-slate-500 capitalize">{t.sensorType}:</span><span className="text-slate-300">{t.value.toFixed(1)} {t.unit}</span></div>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-slate-800 border-slate-600 text-white">
          <p className="font-semibold">{equipment.name}</p>
          {equipment.type && <p className="text-sm text-slate-300">Type: {equipment.type}</p>}
          <p className="text-sm text-slate-300">Health Score: {equipment.healthScore}%</p>
          {equipment.rul !== null && equipment.rul !== undefined && <p className="text-sm text-slate-300">Remaining Useful Life: {equipment.rul} days</p>}
          <p className="text-xs text-slate-400 mt-2">Click to view details</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
