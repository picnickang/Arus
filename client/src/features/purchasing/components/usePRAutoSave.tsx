/**
 * usePRAutoSave
 * Improvement #14: Debounced auto-save hook for Purchase Request drafts.
 *
 * Calls POST /purchase-requests/:id/auto-save every DEBOUNCE_MS after
 * the last change. Shows a "Saved" / "Saving…" / "Unsaved" indicator.
 *
 * Usage:
 *   const { saveStatus, lastSavedAt } = usePRAutoSave(prId, formValues);
 *
 * Also exports usePRBeforeUnload which warns the user if they try to
 * navigate away with unsaved changes.
 */

import React from "react";
import { apiRequest } from "@/lib/queryClient";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 30_000; // 30 seconds of inactivity

interface AutoSaveResult {
  saveStatus:  AutoSaveStatus;
  lastSavedAt: Date | null;
  /** Call this to trigger an immediate save (e.g. on blur or tab close) */
  saveNow:     () => Promise<void>;
}

export function usePRAutoSave(
  prId: string | undefined,
  formValues: Record<string, unknown>,
  enabled = true
): AutoSaveResult {
  const [saveStatus,  setSaveStatus]  = React.useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const timerRef                      = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValuesRef                 = React.useRef<string>("");

  const doSave = React.useCallback(async () => {
    if (!prId || !enabled) return;

    setSaveStatus("saving");
    try {
      const result = await apiRequest("POST", `/api/purchase-requests/${prId}/auto-save`, formValues);
      setLastSavedAt(result?.lastSavedAt ? new Date(result.lastSavedAt) : new Date());
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [prId, formValues, enabled]);

  // Debounce: reset the timer on every form value change
  React.useEffect(() => {
    if (!prId || !enabled) return;

    const serialized = JSON.stringify(formValues);
    if (serialized === prevValuesRef.current) return; // no change
    prevValuesRef.current = serialized;

    setSaveStatus("idle");

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prId, formValues, enabled, doSave]);

  return { saveStatus, lastSavedAt, saveNow: doSave };
}

/**
 * Warn the user before unloading the page when there are unsaved changes.
 */
export function usePRBeforeUnload(saveStatus: AutoSaveStatus) {
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "idle" || saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);
}

/**
 * Small status indicator component for use in the PR form header.
 */
export function PRAutoSaveIndicator({
  saveStatus,
  lastSavedAt,
}: {
  saveStatus:  AutoSaveStatus;
  lastSavedAt: Date | null;
}) {
  if (saveStatus === "idle") return null;

  const label =
    saveStatus === "saving" ? "Saving…" :
    saveStatus === "saved"  ? `Saved ${lastSavedAt ? formatRelative(lastSavedAt) : ""}` :
    saveStatus === "error"  ? "Save failed" : "";

  const colorClass =
    saveStatus === "saving" ? "text-muted-foreground" :
    saveStatus === "saved"  ? "text-emerald-600 dark:text-emerald-400" :
    "text-destructive";

  return (
    <span className={`text-xs ${colorClass}`} aria-live="polite">
      {label}
    </span>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)  return "just now";
  if (diffSec < 120) return "1 minute ago";
  return `${Math.floor(diffSec / 60)} minutes ago`;
}
