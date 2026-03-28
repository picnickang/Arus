/**
 * Page Tracking
 *
 * UX REFACTOR: Extracted from home.tsx so it can be statically imported
 * instead of dynamically importing the entire home module on every navigation.
 */

const RECENT_PAGES_KEY = "arus-recent-pages";
const MAX_RECENT = 8;

export function trackPageVisit(path: string): void {
  try {
    const stored = localStorage.getItem(RECENT_PAGES_KEY);
    const recent: string[] = stored ? JSON.parse(stored) : [];
    const filtered = recent.filter((p) => p !== path);
    filtered.unshift(path);
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function getRecentPages(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_PAGES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearRecentPages(): void {
  try {
    localStorage.removeItem(RECENT_PAGES_KEY);
  } catch {
    // ignore
  }
}
