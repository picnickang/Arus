/**
 * Attention Banner
 *
 * UX REFACTOR: Shows items that need immediate attention at the top of
 * the home screen and hub pages. Replaces the need to navigate to the
 * dashboard to discover overdue items.
 *
 * Tappable — each item navigates to the relevant page.
 */

import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight } from "lucide-react";

export interface AttentionItem {
  label: string;
  count: number;
  severity: string; // "critical" | "warning" | "info"
  href: string;
}

interface AttentionBannerProps {
  items: AttentionItem[];
  className?: string;
}

export function AttentionBanner({ items, className }: AttentionBannerProps) {
  const [, setLocation] = useLocation();

  if (items.length === 0) return null;

  const hasCritical = items.some((i) => i.severity === "critical");

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        hasCritical
          ? "border-destructive/30 bg-destructive/5"
          : "border-yellow-500/30 bg-yellow-500/5",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle
          className={cn(
            "h-4 w-4",
            hasCritical ? "text-destructive" : "text-yellow-500"
          )}
        />
        <span className="text-sm font-semibold text-foreground">
          Needs Attention
        </span>
      </div>

      <div className="space-y-1.5">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => setLocation(item.href)}
            data-testid={`button-attention-${i}`}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                       hover:bg-background/50 transition-colors text-left touch-target"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full text-xs font-bold",
                  item.severity === "critical"
                    ? "bg-destructive text-destructive-foreground"
                    : item.severity === "warning"
                    ? "bg-yellow-500 text-black"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {item.count}
              </span>
              <span className="text-sm text-foreground">{item.label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default AttentionBanner;
