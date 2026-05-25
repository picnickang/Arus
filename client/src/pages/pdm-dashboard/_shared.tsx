import { TrendingUp, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RiskLevel, EvidenceChip } from "@/features/pdm";

export function FleetHealthGauge({
  score,
  change,
  period,
}: {
  score: number;
  change: number;
  period: string;
}) {
  const rotation = (score / 100) * 180 - 90;
  const getColor = () => {
    if (score >= 80) {
      return "text-green-500";
    }
    if (score >= 60) {
      return "text-yellow-500";
    }
    return "text-red-500";
  };

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-24 h-14 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-12 rounded-t-full border-8 border-muted" />
        <div
          className={`absolute inset-x-0 bottom-0 h-12 rounded-t-full border-8 ${getColor().replace("text-", "border-")}`}
          style={{
            clipPath: `polygon(0% 100%, 0% 0%, ${50 + score / 2}% 0%, ${50 + score / 2}% 100%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 w-1 h-10 bg-foreground origin-bottom rounded-full"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
      </div>
      <div className="text-center mt-1">
        <span className={`text-2xl font-bold ${getColor()}`} data-testid="kpi-health-score">
          {score}
        </span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <TrendingUp
          className={`h-3 w-3 ${change >= 0 ? "text-green-500" : "text-red-500 rotate-180"}`}
        />
        <span className={change >= 0 ? "text-green-500" : "text-red-500"}>
          {change > 0 ? "+" : ""}
          {change}
        </span>
        <span className="text-muted-foreground">{period}</span>
      </div>
    </div>
  );
}

export function KpiCardCompact({
  title,
  value,
  subtitle,
  badge,
  variant = "default",
  testId,
}: {
  title: string;
  value: string | number;
  subtitle?: string | undefined;
  badge?: { text: string; variant: "destructive" | "secondary" | "outline" } | undefined;
  variant?: "default" | "success" | "warning" | "danger" | "info" | undefined;
  testId: string;
}) {
  const bgColor = {
    default: "bg-primary",
    success: "bg-green-600 dark:bg-green-700",
    warning: "bg-yellow-500 dark:bg-yellow-600",
    danger: "bg-red-600 dark:bg-red-700",
    info: "bg-blue-600 dark:bg-blue-700",
  }[variant];

  return (
    <div className={`${bgColor} text-white rounded-lg p-3 min-w-[140px] flex-shrink-0`}>
      <p className="text-xs opacity-90 truncate">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-2xl font-bold" data-testid={testId}>
          {value}
        </span>
        {badge && (
          <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
            {badge.text}
          </Badge>
        )}
      </div>
      {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: RiskLevel }) {
  const variants: Record<
    RiskLevel,
    { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
  > = {
    critical: { variant: "destructive" },
    high: { variant: "destructive", className: "bg-orange-500 dark:bg-orange-600" },
    medium: { variant: "secondary", className: "bg-yellow-500 text-yellow-950 dark:bg-yellow-600" },
    low: { variant: "outline", className: "border-green-500 text-green-600 dark:text-green-400" },
  };

  return (
    <Badge {...variants[severity]} className={variants[severity].className}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}

export function StatusBadge({
  status,
}: {
  status: "new" | "active" | "acknowledged" | "resolved";
}) {
  const statusLabels: Record<string, string> = {
    new: "Processing",
    active: "Processing",
    acknowledged: "Approved",
    resolved: "Approved",
  };
  const variants: Record<
    string,
    { variant: "default" | "secondary" | "outline"; className?: string; icon?: typeof CheckCircle }
  > = {
    new: {
      variant: "secondary",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    },
    active: {
      variant: "secondary",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    },
    acknowledged: {
      variant: "secondary",
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      icon: CheckCircle,
    },
    resolved: {
      variant: "secondary",
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      icon: CheckCircle,
    },
  };
  const config = variants[status] || variants['new']!;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function MiniSparkline({
  data,
  color = "hsl(var(--primary))",
}: {
  data: number[];
  color?: string;
}) {
  if (!data || data.length < 2) {
    return null;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 20;
  const width = 60;

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export function EvidenceChipBadge({ chip }: { chip: EvidenceChip }) {
  const typeStyles: Record<EvidenceChip["type"], string> = {
    trend: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    threshold: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    anomaly: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    pattern: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  };

  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 ${typeStyles[chip.type]}`}>
      {chip.label}
    </Badge>
  );
}
