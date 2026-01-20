import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className || ""}`}
      data-testid="empty-state"
    >
      <div className="mb-4 text-muted-foreground">{icon}</div>
      <h3 className="text-lg font-semibold mb-2" data-testid="empty-state-title">
        {title}
      </h3>
      {description && (
        <p
          className="text-sm text-muted-foreground mb-6 max-w-md"
          data-testid="empty-state-description"
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex gap-3">
          {action && (
            <Button onClick={action.onClick} data-testid="empty-state-action">
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              data-testid="empty-state-secondary-action"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
