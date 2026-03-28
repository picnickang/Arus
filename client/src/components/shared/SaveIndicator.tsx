/**
 * Save Status Indicator
 *
 * UX REFACTOR: Shows whether data has been saved locally, synced to server,
 * or is pending sync. Critical for maritime offline-first workflows.
 *
 * Usage:
 *   <SaveIndicator status="saved-local" />
 *   <SaveIndicator status="synced" />
 *   <SaveIndicator status="pending" />
 *   <SaveIndicator status="error" message="Connection lost" />
 */

import { cn } from "@/lib/utils";
import { Check, Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react";

type SaveStatus = "idle" | "saving" | "saved-local" | "synced" | "pending" | "error";

interface SaveIndicatorProps {
  status: SaveStatus;
  message?: string;
  className?: string;
  /** Show as inline text next to save button, or as a standalone badge */
  variant?: "inline" | "badge";
}

const statusConfig: Record<SaveStatus, {
  icon: typeof Check;
  text: string;
  color: string;
  animate?: boolean;
}> = {
  idle: { icon: Check, text: "", color: "text-transparent" },
  saving: { icon: Loader2, text: "Saving...", color: "text-muted-foreground", animate: true },
  "saved-local": { icon: CloudOff, text: "Saved locally", color: "text-yellow-500" },
  synced: { icon: Cloud, text: "Synced", color: "text-green-500" },
  pending: { icon: CloudOff, text: "Will sync when online", color: "text-yellow-500" },
  error: { icon: AlertCircle, text: "Save failed", color: "text-destructive" },
};

export function SaveIndicator({ status, message, className, variant = "inline" }: SaveIndicatorProps) {
  if (status === "idle") return null;

  const config = statusConfig[status];
  const Icon = config.icon;
  const displayText = message || config.text;

  if (variant === "badge") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          status === "synced" && "bg-green-500/10 text-green-500",
          status === "saved-local" && "bg-yellow-500/10 text-yellow-500",
          status === "pending" && "bg-yellow-500/10 text-yellow-500",
          status === "saving" && "bg-muted text-muted-foreground",
          status === "error" && "bg-destructive/10 text-destructive",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Icon className={cn("h-3 w-3", config.animate && "animate-spin")} />
        {displayText}
      </div>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", config.color, className)}
      role="status"
      aria-live="polite"
      data-testid={`status-save-${status}`}
    >
      <Icon className={cn("h-3 w-3", config.animate && "animate-spin")} />
      <span>{displayText}</span>
    </span>
  );
}

/**
 * Offline-aware save button.
 * Changes text from "Save" to "Save (offline)" when disconnected.
 */
interface OfflineSaveButtonProps {
  onSave: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  className?: string;
}

export function OfflineSaveButton({ onSave, isSaving, disabled, className }: OfflineSaveButtonProps) {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  return (
    <button
      onClick={onSave}
      disabled={disabled || isSaving}
      data-testid="button-offline-save"
      className={cn(
        "touch-button px-6 py-3 rounded-lg font-medium transition-colors",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {isSaving ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </span>
      ) : isOnline ? (
        "Save"
      ) : (
        <span className="flex items-center gap-2">
          <CloudOff className="h-4 w-4" />
          Save (will sync when online)
        </span>
      )}
    </button>
  );
}

export default SaveIndicator;
