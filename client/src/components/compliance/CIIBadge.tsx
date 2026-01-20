import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface CIIBadgeProps {
  vesselId: string;
  vesselName?: string;
}

interface CIIRating {
  rating: "A" | "B" | "C" | "D" | "E";
  complianceStatus: "compliant" | "warning" | "non-compliant";
  actualCII: number;
  requiredCII: number;
  percentageVsRequired: number;
  year: number;
}

export function CIIBadge({ vesselId, vesselName }: CIIBadgeProps) {
  const {
    data: ciiData,
    isLoading,
    error,
  } = useQuery<CIIRating>({
    queryKey: ["/api/compliance/cii", vesselId],
    enabled: !!vesselId,
    staleTime: 3600000,
    refetchInterval: 3600000,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1.5" data-testid={`badge-cii-loading-${vesselId}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>CII</span>
      </Badge>
    );
  }

  if (error || !ciiData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="gap-1.5"
              data-testid={`badge-cii-unavailable-${vesselId}`}
            >
              <Info className="h-3 w-3" />
              <span>CII: N/A</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>
              Insufficient data to calculate CII rating. Ensure fuel consumption and speed telemetry
              is available.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getRatingColor = (rating: string): string => {
    switch (rating) {
      case "A":
        return "bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600";
      case "B":
        return "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600";
      case "C":
        return "bg-yellow-600 hover:bg-yellow-700 text-white dark:bg-yellow-500 dark:hover:bg-yellow-600";
      case "D":
        return "bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-500 dark:hover:bg-orange-600";
      case "E":
        return "bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600";
      default:
        return "bg-gray-600 hover:bg-gray-700 text-white";
    }
  };

  const getIcon = () => {
    if (ciiData.complianceStatus === "compliant") {
      return <CheckCircle className="h-3 w-3" />;
    }

    if (ciiData.complianceStatus === "warning" || ciiData.complianceStatus === "non-compliant") {
      return <AlertTriangle className="h-3 w-3" />;
    }
    return null;
  };

  const tooltipText = `
    Carbon Intensity Indicator (CII) Rating
    
    ${vesselName || "Vessel"} - ${ciiData.year}
    Rating: ${ciiData.rating} (${ciiData.complianceStatus})
    
    Actual CII: ${ciiData.actualCII.toFixed(1)} gCO₂/capacity·nm
    Required CII: ${ciiData.requiredCII.toFixed(1)} gCO₂/capacity·nm
    
    ${
      ciiData.percentageVsRequired < 0
        ? `${Math.abs(ciiData.percentageVsRequired).toFixed(1)}% better than required`
        : `${ciiData.percentageVsRequired.toFixed(1)}% above required`
    }
    
    IMO 2023 Compliance: ${ciiData.rating === "A" || ciiData.rating === "B" || ciiData.rating === "C" ? "✓ Compliant" : "⚠ Action Required"}
  `.trim();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`gap-1.5 ${getRatingColor(ciiData.rating)}`}
            data-testid={`badge-cii-${vesselId}`}
          >
            {getIcon()}
            <span>CII: {ciiData.rating}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-line">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
