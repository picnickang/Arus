import { AlertCircle, Info, Lightbulb } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ScenarioBannerProps {
  type?: "info" | "guidance" | "alert";
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * ScenarioBanner component - Contextual guidance banners for different analytics modes
 */
export function ScenarioBanner({
  type = "info",
  title,
  description,
  actions,
  className = "",
}: ScenarioBannerProps) {
  const icons = {
    info: Info,
    guidance: Lightbulb,
    alert: AlertCircle,
  };

  const Icon = icons[type];

  const variants = {
    info: "border-blue-500/50 bg-blue-500/10",
    guidance: "border-amber-500/50 bg-amber-500/10",
    alert: "border-red-500/50 bg-red-500/10",
  };

  return (
    <Alert className={`${variants[type]} ${className}`} data-testid="scenario-banner">
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        {description}
        {actions && <div className="mt-3">{actions}</div>}
      </AlertDescription>
    </Alert>
  );
}
