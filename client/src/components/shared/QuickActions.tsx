/**
 * Quick Actions Component
 *
 * UX REFACTOR: One-tap access to the 4 most common actions per role.
 * Eliminates the Home → Hub → Page → Form navigation chain.
 *
 * Renders as a horizontal scroll strip on mobile, grid on desktop.
 */

import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface QuickActionItem {
  label: string;
  icon: LucideIcon;
  href: string;
  variant?: "default" | "destructive" | "outline";
}

interface QuickActionsProps {
  actions: QuickActionItem[];
  className?: string;
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  const [, setLocation] = useLocation();

  if (actions.length === 0) {return null;}

  return (
    <div className={cn("", className)}>
      <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:overflow-visible scrollbar-hide">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.href}
              onClick={() => setLocation(action.href)}
              data-testid={`button-quick-action-${action.href.replace(/[/?=&]/g, '-').replace(/^-/, '')}`}
              className={cn(
                "flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                "touch-target cursor-pointer min-w-[160px] md:min-w-0",
                action.variant === "destructive"
                  ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive"
                  : "border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default QuickActions;
