const RECENT_PAGES_KEY = "arus-recent-pages";
const LAST_VISIT_KEY = "arus-last-visit-time";
const MAX_RECENT = 8;

export function trackPageVisit(path: string): void {
  try {
    const stored = localStorage.getItem(RECENT_PAGES_KEY);
    const recent: string[] = stored ? JSON.parse(stored) : [];
    const filtered = recent.filter((p) => p !== path);
    filtered.unshift(path);
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch {
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

export function getLastVisitTime(): string | null {
  try {
    return localStorage.getItem(LAST_VISIT_KEY);
  } catch {
    return null;
  }
}

export function recordVisitTime(): void {
  try {
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  } catch {
  }
}

export function clearRecentPages(): void {
  try {
    localStorage.removeItem(RECENT_PAGES_KEY);
  } catch {
  }
}
