import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Activity, Info } from "lucide-react";

interface OperatingModeChipProps {
  vesselId: string;
  className?: string;
}

interface ModeDetectionResult {
  mode: "DP" | "Transit" | "Harbor" | "Cargo_Ops" | "Standby" | "Docking" | "Unknown";
  confidence: number;
  indicators: string[];
  timestamp: string;
  color: string;
  label: string;
}

export function OperatingModeChip({ vesselId, className = "" }: OperatingModeChipProps) {
  const {
    data: modeData,
    isLoading,
    error,
  } = useQuery<ModeDetectionResult>({
    queryKey: ["/api/vessels", vesselId, "operating-mode"],
    enabled: !!vesselId,
    staleTime: 60000,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Badge
        variant="outline"
        className={`gap-1.5 ${className}`}
        data-testid={`chip-mode-loading-${vesselId}`}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Mode</span>
      </Badge>
    );
  }

  if (error || !modeData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1.5 ${className}`}
              data-testid={`chip-mode-unavailable-${vesselId}`}
            >
              <Info className="h-3 w-3" />
              <span>Mode: N/A</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>No recent telemetry data available</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getModeStyle = (mode: string): string => {
    const baseStyles = "text-white font-medium";

    switch (mode) {
      case "DP":
        return `${baseStyles} bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`;
      case "Transit":
        return `${baseStyles} bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600`;
      case "Harbor":
        return `${baseStyles} bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600`;
      case "Cargo_Ops":
        return `${baseStyles} bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600`;
      case "Standby":
        return `${baseStyles} bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600`;
      case "Docking":
        return `${baseStyles} bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600`;
      default:
        return `${baseStyles} bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700`;
    }
  };

  const confidencePercent = Math.round(modeData.confidence * 100);

  const tooltipText = `
    Operating Mode Detection
    
    Mode: ${modeData.label}
    Confidence: ${confidencePercent}%
    
    Indicators:
    ${modeData.indicators.map((i) => `• ${i}`).join("\n")}
    
    Last updated: ${new Date(modeData.timestamp).toLocaleTimeString()}
  `.trim();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`gap-1.5 ${getModeStyle(modeData.mode)} ${className}`}
            data-testid={`chip-mode-${vesselId}`}
          >
            <Activity className="h-3 w-3" />
            <span>{modeData.label}</span>
            {confidencePercent < 70 && (
              <span className="text-xs opacity-70">({confidencePercent}%)</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-line">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
