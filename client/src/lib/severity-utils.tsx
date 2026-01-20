import { AlertTriangle, CheckCircle, Info, AlertCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SeverityLevel = "critical" | "warning" | "caution" | "good" | "info";

export interface SeverityConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: React.ElementType;
  badgeVariant: "default" | "destructive" | "outline" | "secondary";
  description: string;
}

// WCAG 2.1 AA compliant color schemes
export const severityConfig: Record<SeverityLevel, SeverityConfig> = {
  critical: {
    label: "Critical",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-red-500",
    textColor: "text-red-700 dark:text-red-300",
    icon: AlertTriangle,
    badgeVariant: "destructive",
    description: "Immediate action required - equipment failure imminent or in progress",
  },
  warning: {
    label: "Warning",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    borderColor: "border-orange-500",
    textColor: "text-orange-700 dark:text-orange-300",
    icon: AlertCircle,
    badgeVariant: "default",
    description: "Attention needed soon - potential issue detected",
  },
  caution: {
    label: "Caution",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    borderColor: "border-yellow-500",
    textColor: "text-yellow-700 dark:text-yellow-300",
    icon: HelpCircle,
    badgeVariant: "outline",
    description: "Monitor situation - deviation from normal detected",
  },
  good: {
    label: "Good",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    borderColor: "border-green-500",
    textColor: "text-green-700 dark:text-green-300",
    icon: CheckCircle,
    badgeVariant: "outline",
    description: "Operating normally - no action required",
  },
  info: {
    label: "Info",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-500",
    textColor: "text-blue-700 dark:text-blue-300",
    icon: Info,
    badgeVariant: "secondary",
    description: "Informational - reference data",
  },
};

/**
 * Get severity level based on health score (0-100)
 */
export function getSeverityFromHealth(health: number): SeverityLevel {
  if (health < 30) {return "critical";}
  if (health < 50) {return "warning";}
  if (health < 70) {return "caution";}
  return "good";
}

/**
 * Get severity level based on risk level string
 */
export function getSeverityFromRisk(risk: string): SeverityLevel {
  const riskLower = risk.toLowerCase();
  if (riskLower === "critical" || riskLower === "high") {return "critical";}
  if (riskLower === "medium") {return "warning";}
  if (riskLower === "low") {return "caution";}
  return "info";
}

/**
 * Get severity level based on prediction probability
 */
export function getSeverityFromProbability(probability: number): SeverityLevel {
  if (probability >= 0.8) {return "critical";}
  if (probability >= 0.6) {return "warning";}
  if (probability >= 0.4) {return "caution";}
  return "info";
}

/**
 * Get card classes with severity styling
 */
export function getSeverityCardClasses(severity: SeverityLevel, withAnimation = false): string {
  const config = severityConfig[severity];

  const baseClasses = cn(
    "border-2",
    config.borderColor,
    config.bgColor,
    "transition-all duration-200"
  );

  const animationClasses =
    withAnimation && severity === "critical" ? "animate-pulse shadow-lg shadow-red-500/20" : "";

  return cn(baseClasses, animationClasses);
}

/**
 * Severity Icon component with proper accessibility
 */
interface SeverityIconProps {
  severity: SeverityLevel;
  className?: string;
  showLabel?: boolean;
}

export function SeverityIcon({ severity, className, showLabel = false }: SeverityIconProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn(config.color, className)} aria-hidden="true" />
      {showLabel && (
        <span className={cn("text-sm font-medium", config.textColor)}>{config.label}</span>
      )}
    </div>
  );
}

/**
 * Get severity badge component props
 */
export function getSeverityBadgeProps(severity: SeverityLevel) {
  const config = severityConfig[severity];
  return {
    variant: config.badgeVariant,
    className: cn(config.textColor, config.bgColor),
  };
}
