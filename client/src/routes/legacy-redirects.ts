/**
 * Legacy Redirects — Minimal redirect map for critical external bookmarks only.
 *
 * Rules:
 * - Only "keep" entries survive. Everything else has been retired.
 * - Do NOT add new entries. Fix navigation at the source instead.
 */
import { routeMigrations } from "@/config/navigationConfig";

export type RedirectExpiry = "keep";

export interface LegacyRedirect {
  from: string;
  to: string;
  expires: RedirectExpiry;
}

const additionalRedirects: LegacyRedirect[] = [
  { from: "/alerts", to: "/dashboard", expires: "keep" },
  { from: "/active-telemetry", to: "/dashboard?tab=telemetry", expires: "keep" },
  { from: "/actionable-insights", to: "/dashboard?tab=insights", expires: "keep" },
];

const migrationRedirects: LegacyRedirect[] = Object.entries(routeMigrations || {}).map(
  ([from, to]) => ({ from, to, expires: "keep" as RedirectExpiry })
);

export const legacyRedirects: LegacyRedirect[] = [
  ...additionalRedirects,
  ...migrationRedirects,
].filter((redirect, index, self) => index === self.findIndex((r) => r.from === redirect.from));

const STORAGE_KEY = "arus:redirect_usage";

export function trackRedirectUsage(from: string, to: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const usage: Record<string, { count: number; lastUsed: string }> = raw ? JSON.parse(raw) : {};
    const entry = usage[from] || { count: 0, lastUsed: "" };
    entry.count += 1;
    entry.lastUsed = new Date().toISOString();
    usage[from] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {}
}

export function getRedirectUsageStats(): Record<string, { count: number; lastUsed: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
