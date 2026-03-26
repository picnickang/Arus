import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardVariant = "default" | "success" | "warning" | "danger" | "info";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  trend?: {
    value: number;
    label?: string;
    invertColor?: boolean;
  };
  badge?: {
    text: string;
    variant?: "default" | "destructive" | "outline" | "secondary";
  };
  helpText?: string;
  variant?: StatCardVariant;
  loading?: boolean;
  className?: string;
}

const variantStyles: Record<StatCardVariant, string> = {
  default: "",
  success: "border-green-200 dark:border-green-900",
  warning: "border-yellow-200 dark:border-yellow-900",
  danger: "border-red-200 dark:border-red-900",
  info: "border-blue-200 dark:border-blue-900",
};

const variantIconStyles: Record<StatCardVariant, string> = {
  default: "text-muted-foreground",
  success: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
};

function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className} data-testid="stat-card-skeleton">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  badge,
  helpText,
  variant = "default",
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return <StatCardSkeleton className={className} />;
  }

  const trendPositive = trend ? trend.value > 0 : false;
  const trendNeutral = trend ? trend.value === 0 : false;
  const trendColor = trend
    ? trendNeutral
      ? "text-muted-foreground"
      : trend.invertColor
        ? trendPositive
          ? "text-red-600 dark:text-red-400"
          : "text-green-600 dark:text-green-400"
        : trendPositive
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
    : "";

  const TrendIcon = trend
    ? trendPositive
      ? TrendingUp
      : TrendingDown
    : null;

  return (
    <Card
      className={cn(variantStyles[variant], className)}
      data-testid="stat-card"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground truncate">{label}</p>
              {helpText && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 cursor-help rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                        aria-label={`Help: ${label}`}
                        data-testid="stat-card-help"
                      >
                        <HelpCircle
                          className="h-3.5 w-3.5 text-muted-foreground/60"
                          aria-hidden="true"
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-sm">{helpText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <p
              className="text-2xl font-bold tracking-tight"
              data-testid="stat-card-value"
            >
              {value}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {trend && !trendNeutral && TrendIcon && (
                <span
                  className={cn("flex items-center gap-0.5 text-xs font-medium", trendColor)}
                  data-testid="stat-card-trend"
                >
                  <TrendIcon className="h-3 w-3" aria-hidden="true" />
                  {Math.abs(trend.value)}%
                  {trend.label && (
                    <span className="text-muted-foreground ml-0.5">
                      {trend.label}
                    </span>
                  )}
                </span>
              )}
              {badge && (
                <Badge
                  variant={badge.variant ?? "secondary"}
                  className="text-xs"
                  data-testid="stat-card-badge"
                >
                  {badge.text}
                </Badge>
              )}
            </div>
          </div>

          {Icon && (
            <div
              className={cn(
                "p-2 rounded-md bg-muted/50 shrink-0",
                variantIconStyles[variant]
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
