import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TrendData {
  direction: 'up' | 'down' | 'neutral';
  value: number;
  label: string;
}

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: TrendData;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  tooltip?: string;
  className?: string;
  'data-testid'?: string;
}

const variantColors = {
  default: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-orange-500',
  danger: 'text-red-500',
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const trendColors = {
  up: 'text-green-500',
  down: 'text-red-500',
  neutral: 'text-gray-500',
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  loading = false,
  variant = 'default',
  tooltip,
  className,
  'data-testid': testId,
}: KpiCardProps) {
  const cardContent = (
    <Card className={cn("flex-shrink-0 min-w-[200px] md:min-w-0", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg bg-muted", variantColors[variant])}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate" data-testid={`${testId}-label`}>
              {label}
            </p>
            
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" data-testid={`${testId}-skeleton`} />
            ) : (
              <p className="text-2xl font-bold mt-1 truncate" data-testid={`${testId}-value`}>
                {value}
              </p>
            )}
            
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate" data-testid={`${testId}-subtitle`}>
                {subtitle}
              </p>
            )}
            
            {trend && !loading && (
              <div className="flex items-center gap-1 mt-2">
                {(() => {
                  const TrendIcon = trendIcons[trend.direction];
                  return (
                    <TrendIcon 
                      className={cn("h-3 w-3", trendColors[trend.direction])} 
                      data-testid={`${testId}-trend-icon`}
                    />
                  );
                })()}
                <span className={cn("text-xs font-medium", trendColors[trend.direction])}>
                  {trend.value}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div data-testid={testId}>{cardContent}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <div data-testid={testId}>{cardContent}</div>;
}
