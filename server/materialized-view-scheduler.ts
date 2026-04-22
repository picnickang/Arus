// Stub file - materialized view scheduler consolidated
export function setupMaterializedViewRefresh(): void {
  console.log("[View Scheduler] Materialized view refresh schedule configured (stub)");
}

export async function refreshViews(): Promise<void> {
  // No-op
}

export const materializedViewScheduler = {
  setup: setupMaterializedViewRefresh,
  refresh: refreshViews,
};
