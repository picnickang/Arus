export interface AlertConfig {
  id: string;
  vesselId: string;
  orgId: string;
  alertType: string;
  name: string;
  config: Record<string, unknown>;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
  notifyEmail: boolean;
  notifyInApp: boolean;
}

export function getRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
}

export function getFirstRow(result: unknown): Record<string, unknown> | undefined {
  return getRows(result)[0];
}
