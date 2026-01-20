/**
 * UnifiedMetricCard - Consolidated metric/KPI card component
 * 
 * This component unifies the following duplicate implementations:
 * - components/metric-card.tsx (gradient, trend, progress)
 * - components/shared/MetricCard.tsx (status, thresholds)
 * - components/ml-ai/data-display/KpiCard.tsx (loading, tooltip)
 * - components/fleet/FleetKpiHeader.tsx (fleet-specific, dark/light variants)
 * 
 * Supports all use cases: dashboards, analytics, fleet, ML/AI pages
 */

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export type MetricStatus = "healthy" | "warning" | "critical" | "elevated" | "unknown";
export type MetricVariant = "default" | "minimal" | "compact" | "dark";
export type MetricColor = "blue" | "green" | "yellow" | "red" | "purple" | "orange" | "indigo";

export interface MetricTrend {
  direction: "up" | "down" | "neutral";
  value: string | number;
  label?: string;
  isPositive?: boolean;
}

export interface MetricThresholds {
  warning?: number;
  critical?: number;
}

export interface UnifiedMetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  unit?: string;
  subtitle?: string;
  
  status?: MetricStatus;
  variant?: MetricVariant;
  color?: MetricColor;
  
  trend?: MetricTrend;
  progress?: number;
  thresholds?: MetricThresholds;
  
  loading?: boolean;
  tooltip?: string;
  timestamp?: Date | string;
  
  className?: string;
  onClick?: () => void;
  "data-testid"?: string;
}

const statusColors: Record<MetricStatus, string> = {
  healthy: "border-green-500/50 bg-green-500/10",
  warning: "border-amber-500/50 bg-amber-500/10",
  critical: "border-destructive/50 bg-destructive/10",
  elevated: "border-amber-500/50 bg-amber-500/10",
  unknown: "border-muted",
};

const colorGradients: Record<MetricColor, string> = {
  blue: "from-blue-500/20 to-cyan-500/20 dark:from-blue-600/30 dark:to-cyan-600/30",
  green: "from-emerald-500/20 to-teal-500/20 dark:from-emerald-600/30 dark:to-teal-600/30",
  yellow: "from-yellow-500/20 to-amber-500/20 dark:from-yellow-600/30 dark:to-amber-600/30",
  red: "from-red-500/20 to-rose-500/20 dark:from-red-600/30 dark:to-rose-600/30",
  purple: "from-purple-500/20 to-pink-500/20 dark:from-purple-600/30 dark:to-pink-600/30",
  orange: "from-orange-500/20 to-amber-500/20 dark:from-orange-600/30 dark:to-amber-600/30",
  indigo: "from-indigo-500/20 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/30",
};

const iconBgColors: Record<MetricColor, string> = {
  blue: "bg-blue-500/20 dark:bg-blue-500/30",
  green: "bg-emerald-500/20 dark:bg-emerald-500/30",
  yellow: "bg-yellow-500/20 dark:bg-yellow-500/30",
  red: "bg-red-500/20 dark:bg-red-500/30",
  purple: "bg-purple-500/20 dark:bg-purple-500/30",
  orange: "bg-orange-500/20 dark:bg-orange-500/30",
  indigo: "bg-indigo-500/20 dark:bg-indigo-500/30",
};

const iconTextColors: Record<MetricColor, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-emerald-600 dark:text-emerald-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  red: "text-red-600 dark:text-red-400",
  purple: "text-purple-600 dark:text-purple-400",
  orange: "text-orange-600 dark:text-orange-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
};

const darkVariantColors: Record<MetricColor, { bg: string; border: string; icon: string }> = {
  blue: {
    bg: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/50",
    icon: "text-blue-400",
  },
  green: {
    bg: "from-green-500/20 to-green-600/10",
    border: "border-green-500/50",
    icon: "text-green-400",
  },
  yellow: {
    bg: "from-yellow-500/20 to-yellow-600/10",
    border: "border-yellow-500/50",
    icon: "text-yellow-400",
  },
  red: {
    bg: "from-red-500/20 to-red-600/10",
    border: "border-red-500/50",
    icon: "text-red-400",
  },
  purple: {
    bg: "from-purple-500/20 to-purple-600/10",
    border: "border-purple-500/50",
    icon: "text-purple-400",
  },
  orange: {
    bg: "from-orange-500/20 to-orange-600/10",
    border: "border-orange-500/50",
    icon: "text-orange-400",
  },
  indigo: {
    bg: "from-indigo-500/20 to-indigo-600/10",
    border: "border-indigo-500/50",
    icon: "text-indigo-400",
  },
};

function UnifiedMetricCardComponent({
  label,
  value,
  icon: Icon,
  unit,
  subtitle,
  status,
  variant = "default",
  color = "blue",
  trend,
  progress,
  thresholds,
  loading = false,
  tooltip,
  timestamp,
  className,
  onClick,
  "data-testid": testId,
}: UnifiedMetricCardProps) {
  const testIdBase = testId || `metric-${label.toLowerCase().replace(/\s+/g, "-")}`;

  const getCardClasses = () => {
    const base = "transition-all duration-200";
    
    if (variant === "dark") {
      const darkColors = darkVariantColors[color];
      return cn(
        base,
        `bg-gradient-to-br ${darkColors.bg} ${darkColors.border}`,
        "hover:scale-[1.02]",
        onClick && "cursor-pointer"
      );
    }
    
    if (variant === "minimal") {
      return cn(base, "hover:border-primary/50 border-border");
    }
    
    if (variant === "compact") {
      return cn(
        base,
        "p-3",
        status && statusColors[status],
        onClick && "cursor-pointer hover:bg-muted/80"
      );
    }
    
    return cn(
      base,
      status ? statusColors[status] : `bg-gradient-to-br ${colorGradients[color]}`,
      "hover:shadow-lg hover:scale-[1.02]",
      onClick && "cursor-pointer"
    );
  };

  const getProgressColor = () => {
    if (status === "critical") {return "[&>div]:bg-destructive";}
    if (status === "warning" || status === "elevated") {return "[&>div]:bg-amber-500";}
    if (color === "green") {return "[&>div]:bg-emerald-500";}
    if (color === "red") {return "[&>div]:bg-red-500";}
    return "";
  };

  const getTrendColor = () => {
    if (!trend) {return "";}
    if (trend.isPositive !== undefined) {
      return trend.isPositive ? "text-green-500" : "text-red-500";
    }
    return trend.direction === "up" ? "text-green-500" : 
           trend.direction === "down" ? "text-red-500" : "text-muted-foreground";
  };

  const TrendIcon = trend ? 
    (trend.direction === "up" ? TrendingUp : 
     trend.direction === "down" ? TrendingDown : Minus) : null;

  const cardContent = (
    <Card 
      className={cn(getCardClasses(), className)}
      onClick={onClick}
      data-testid={testIdBase}
    >
      <CardContent className={cn(
        variant === "compact" ? "p-3" : "p-4 md:p-6",
        variant === "dark" && "p-4"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className={cn(
                "text-sm font-medium truncate",
                variant === "dark" ? "text-slate-400" : "text-muted-foreground"
              )}>
                {label}
              </p>
              {status && status !== "unknown" && (
                <Badge 
                  variant={status === "critical" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {status.toUpperCase()}
                </Badge>
              )}
            </div>
            
            {loading ? (
              <Skeleton className="h-8 w-24 mt-1" data-testid={`${testIdBase}-skeleton`} />
            ) : (
              <p 
                className={cn(
                  "font-bold mt-1 truncate",
                  variant === "compact" ? "text-xl" : "text-2xl md:text-3xl",
                  variant === "dark" ? "text-white" : "text-foreground"
                )}
                data-testid={`${testIdBase}-value`}
              >
                {value}
                {unit && (
                  <span className={cn(
                    "text-lg ml-1",
                    variant === "dark" ? "text-slate-400" : "text-muted-foreground"
                  )}>
                    {unit}
                  </span>
                )}
              </p>
            )}
            
            {subtitle && !loading && (
              <p className={cn(
                "text-xs mt-1 truncate",
                variant === "dark" ? "text-slate-500" : "text-muted-foreground"
              )}>
                {subtitle}
              </p>
            )}
          </div>
          
          {Icon && (
            <div className={cn(
              "rounded-xl transition-transform duration-200 flex-shrink-0",
              variant === "minimal" ? "p-2 bg-muted" : "p-3 hover:scale-110",
              variant === "dark" ? "" : iconBgColors[color]
            )}>
              <Icon 
                className={cn(
                  "h-5 w-5 md:h-6 md:w-6",
                  variant === "minimal" ? "text-muted-foreground" : 
                  variant === "dark" ? darkVariantColors[color].icon : 
                  iconTextColors[color]
                )}
              />
            </div>
          )}
        </div>

        {progress !== undefined && !loading && (
          <div className="mt-3">
            <Progress 
              value={progress} 
              className={cn("h-2", getProgressColor())} 
            />
          </div>
        )}

        {trend && !loading && (
          <div className="mt-3 flex items-center gap-1 text-sm">
            {TrendIcon && (
              <TrendIcon className={cn("h-4 w-4", getTrendColor())} />
            )}
            <span className={cn("font-semibold", getTrendColor())}>
              {trend.value}
              {typeof trend.value === "number" && "%"}
            </span>
            {trend.label && (
              <span className="text-muted-foreground ml-1">{trend.label}</span>
            )}
          </div>
        )}

        {thresholds && !loading && (
          <div className="text-xs text-muted-foreground mt-3 space-y-1">
            {thresholds.warning !== undefined && (
              <div className="flex justify-between">
                <span>Warning:</span>
                <span className="font-medium">{thresholds.warning}{unit}</span>
              </div>
            )}
            {thresholds.critical !== undefined && (
              <div className="flex justify-between">
                <span>Critical:</span>
                <span className="font-medium text-destructive">{thresholds.critical}{unit}</span>
              </div>
            )}
          </div>
        )}

        {timestamp && !loading && (
          <p className="text-xs text-muted-foreground mt-2">
            Updated: {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}

export const UnifiedMetricCard = memo(UnifiedMetricCardComponent);

/**
 * MetricCardGrid - Helper component for laying out multiple metric cards
 */
interface MetricCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function MetricCardGrid({ children, columns = 4, className }: MetricCardGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}
