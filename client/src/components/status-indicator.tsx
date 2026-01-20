import { cn } from "@/lib/utils";
import type { DeviceStatus } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatusIndicatorProps {
  status: DeviceStatus | "healthy" | "warning" | "critical" | "offline";
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function StatusIndicator({
  status,
  showLabel = false,
  showTooltip = true,
  className,
}: StatusIndicatorProps) {
  const normalizedStatus = status?.toLowerCase() ?? "offline";
  
  const getStatusClass = () => {
    switch (normalizedStatus) {
      case "online":
      case "healthy":
        return "status-healthy";
      case "warning":
        return "status-warning";
      case "critical":
        return "status-critical";
      case "offline":
        return "status-offline";
      default:
        return "status-offline";
    }
  };

  const getStatusLabel = () => {
    switch (normalizedStatus) {
      case "online":
        return "Online";
      case "healthy":
        return "Healthy";
      case "warning":
        return "Warning";
      case "critical":
        return "Critical";
      case "offline":
        return "Offline";
      default:
        return "Unknown";
    }
  };

  const getStatusDescription = () => {
    switch (normalizedStatus) {
      case "online":
      case "healthy":
        return "Equipment is operating normally with no issues detected";
      case "warning":
        return "Equipment requires monitoring - maintenance may be needed soon";
      case "critical":
        return "Equipment requires immediate attention - risk of failure";
      case "offline":
        return "Equipment is not responding or disconnected";
      default:
        return "Status unknown";
    }
  };

  const indicator = (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("status-indicator", getStatusClass())}></span>
      {showLabel && <span className="text-sm">{getStatusLabel()}</span>}
    </div>
  );

  if (!showTooltip) {
    return indicator;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{getStatusLabel()}</p>
            <p className="text-xs text-muted-foreground">{getStatusDescription()}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
