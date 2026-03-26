import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertTriangle, AlertCircle, Info, CheckCircle, Activity, Moon, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FatigueLevel = "critical" | "high" | "medium" | "low";

export interface FatigueRiskResult {
  crewId: string;
  crewName?: string;
  score: number;
  level: FatigueLevel;
  factors: {
    sleepDebt24h: number;
    sleepDebt7d: number;
    consecutiveNightShifts: number;
    nightWorkRatio: number;
    totalWorkHours7d: number;
    avgDailyRest: number;
  };
  recommendations: string[];
  calculatedAt: string;
}

interface FatigueRiskBadgeProps {
  crewId: string;
  crewName?: string;
  compact?: boolean;
  showScore?: boolean;
  lookbackDays?: number;
  className?: string;
}

// Default fallback config for unknown fatigue levels
const defaultLevelConfig = {
  label: "Unknown",
  color: "text-gray-700 dark:text-gray-400",
  bgColor: "bg-gray-500/20",
  borderColor: "border-gray-500/50",
  icon: Info,
};

const levelConfig: Record<FatigueLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
}> = {
  critical: {
    label: "Critical",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/50",
    icon: AlertCircle,
  },
  high: {
    label: "High",
    color: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/50",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/50",
    icon: Info,
  },
  low: {
    label: "Low",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/50",
    icon: CheckCircle,
  },
};

// Safe getter for level config with fallback
function getLevelConfig(level: string) {
  return levelConfig[level as FatigueLevel] || defaultLevelConfig;
}

export function FatigueRiskBadge({
  crewId,
  crewName,
  compact = false,
  showScore = true,
  lookbackDays = 14,
  className,
}: FatigueRiskBadgeProps) {
  const { data: fatigueData, isLoading, error } = useQuery<FatigueRiskResult>({
    queryKey: [`/api/hor/fatigue/${crewId}?days=${lookbackDays}`],
    enabled: !!crewId,
    staleTime: 300000,
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1.5", className)} data-testid={`badge-fatigue-loading-${crewId}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {!compact && <span>Fatigue</span>}
      </Badge>
    );
  }

  if (error || !fatigueData) {
    return (
      <Badge variant="outline" className={cn("gap-1.5 text-muted-foreground", className)} data-testid={`badge-fatigue-unavailable-${crewId}`}>
        <Activity className="h-3 w-3" />
        {!compact && <span>N/A</span>}
      </Badge>
    );
  }

  const config = getLevelConfig(fatigueData.level);
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      tabIndex={0}
      className={cn(
        "gap-1.5 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
      data-testid={`badge-fatigue-${fatigueData.level}-${crewId}`}
    >
      <Icon className="h-3 w-3" />
      {compact ? (
        showScore && <span>{fatigueData.score}</span>
      ) : (
        <span>
          {showScore ? `${config.label} (${fatigueData.score})` : config.label}
        </span>
      )}
      <ChevronDown className="h-3 w-3 opacity-50" />
    </Badge>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <FatigueDetailsContent data={fatigueData} crewName={crewName} lookbackDays={lookbackDays} />
      </PopoverContent>
    </Popover>
  );
}

interface FatigueDetailsContentProps {
  data: FatigueRiskResult;
  crewName?: string;
  lookbackDays?: number;
}

function FatigueDetailsContent({ data, crewName, lookbackDays = 14 }: FatigueDetailsContentProps) {
  const config = getLevelConfig(data.level);
  const Icon = config.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-sm">Fatigue Risk Assessment</h4>
          <p className="text-xs text-muted-foreground">
            {crewName || data.crewName || "Crew Member"}
          </p>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium", config.bgColor, config.color)}>
          <Icon className="h-4 w-4" />
          <span>{config.label}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Risk Score</span>
          <span className="font-medium">{data.score}/100</span>
        </div>
        <Progress 
          value={data.score} 
          className={cn("h-2", data.level === "critical" ? "[&>div]:bg-red-500" : 
            data.level === "high" ? "[&>div]:bg-orange-500" :
            data.level === "medium" ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
          )}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h5 className="text-xs font-medium uppercase text-muted-foreground">Contributing Factors</h5>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Night Shifts</p>
              <p className="font-medium">{data.factors.consecutiveNightShifts} consecutive</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Night Work</p>
              <p className="font-medium">{Math.round(data.factors.nightWorkRatio)}%</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Sleep Debt (24h)</p>
              <p className="font-medium">{data.factors.sleepDebt24h.toFixed(1)}h</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Sleep Debt (7d)</p>
              <p className="font-medium">{data.factors.sleepDebt7d.toFixed(1)}h</p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Weekly Work Hours</span>
            <span className="font-medium">{data.factors.totalWorkHours7d.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Avg Daily Rest</span>
            <span className="font-medium">{data.factors.avgDailyRest.toFixed(1)}h</span>
          </div>
        </div>
      </div>

      {data.recommendations.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h5 className="text-xs font-medium uppercase text-muted-foreground">Recommendations</h5>
            <ul className="space-y-1">
              {data.recommendations.map((rec, i) => (
                <li key={`rec-${rec.slice(0, 30)}-${i}`} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="pt-2 text-xs text-muted-foreground text-right">
        Updated: {new Date(data.calculatedAt).toLocaleTimeString()}
      </div>

      <div className="pt-2 border-t text-xs text-muted-foreground">
        Fatigue scores are calculated using STCW-compliant algorithms based on rest hours, night shifts, and work patterns over the past {lookbackDays} days. Scores above 70 indicate significant fatigue risk.
      </div>
    </div>
  );
}

export function FatigueSummaryCard({
  vesselId,
  vesselName,
}: {
  vesselId: string;
  vesselName?: string;
}) {
  const { data, isLoading, error } = useQuery<{
    vesselId: string;
    lookbackDays: number;
    summary: {
      totalCrew: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      averageScore: number;
      highestRiskCrew: Array<{ crewId: string; crewName?: string; score: number; level: FatigueLevel }>;
    };
    crewFatigue: FatigueRiskResult[];
  }>({
    queryKey: [`/api/hor/fatigue/vessel/${vesselId}`],
    enabled: !!vesselId,
    staleTime: 300000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`fatigue-summary-loading-${vesselId}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading fatigue data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-sm text-muted-foreground" data-testid={`fatigue-summary-unavailable-${vesselId}`}>
        Fatigue data unavailable
      </div>
    );
  }

  const { summary } = data;
  const hasRisks = summary.criticalCount > 0 || summary.highCount > 0;

  return (
    <div className="space-y-3" data-testid={`fatigue-summary-${vesselId}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <span>Crew Fatigue Overview</span>
          {vesselName && <span className="text-muted-foreground">- {vesselName}</span>}
        </h4>
        {hasRisks && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {summary.criticalCount + summary.highCount} at risk
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className={cn("rounded-md p-2", summary.criticalCount > 0 ? "bg-red-500/20" : "bg-muted/50")}>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{summary.criticalCount}</p>
          <p className="text-xs text-muted-foreground">Critical</p>
        </div>
        <div className={cn("rounded-md p-2", summary.highCount > 0 ? "bg-orange-500/20" : "bg-muted/50")}>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{summary.highCount}</p>
          <p className="text-xs text-muted-foreground">High</p>
        </div>
        <div className={cn("rounded-md p-2", summary.mediumCount > 0 ? "bg-amber-500/20" : "bg-muted/50")}>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.mediumCount}</p>
          <p className="text-xs text-muted-foreground">Medium</p>
        </div>
        <div className="rounded-md p-2 bg-green-500/20">
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{summary.lowCount}</p>
          <p className="text-xs text-muted-foreground">Low</p>
        </div>
      </div>

      {summary.highestRiskCrew.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase font-medium">Highest Risk Crew</p>
          <div className="space-y-1">
            {summary.highestRiskCrew.slice(0, 3).map((crew) => (
              <div key={crew.crewId} className="flex items-center justify-between text-sm">
                <span>{crew.crewName || crew.crewId}</span>
                <FatigueRiskBadge crewId={crew.crewId} crewName={crew.crewName} compact showScore />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
