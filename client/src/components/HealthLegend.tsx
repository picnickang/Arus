import { memo } from "react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const HealthLegend = memo(function HealthLegend() {
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">Health Index Guide</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-chart-3"></div>
                <span className="text-muted-foreground">75-100% = Healthy (Good condition)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-chart-2"></div>
                <span className="text-muted-foreground">50-74% = Warning (Monitor closely)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive"></div>
                <span className="text-muted-foreground">0-49% = Critical (Service required)</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export const HealthIndexTooltip = memo(function HealthIndexTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <p className="font-semibold">Health Index (0-100%)</p>
            <div className="space-y-1">
              <p>
                <span className="text-chart-3">●</span> 75-100%: Healthy - Equipment in good
                condition
              </p>
              <p>
                <span className="text-chart-2">●</span> 50-74%: Warning - Monitor closely, service
                soon
              </p>
              <p>
                <span className="text-destructive">●</span> 0-49%: Critical - Immediate service
                required
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export const StatusLegend = memo(function StatusLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="status-indicator status-healthy"></span>
        <span>Healthy</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="status-indicator status-warning"></span>
        <span>Warning</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="status-indicator status-critical"></span>
        <span>Critical</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="status-indicator status-offline"></span>
        <span>Offline</span>
      </div>
    </div>
  );
});
