/**
 * Digital Twin - Types
 */

export interface ErrorLogFilters {
  orgId?: string;
  severity?: "info" | "warning" | "error" | "critical";
  category?: "frontend" | "backend" | "api" | "database" | "security" | "performance";
  resolved?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}

export interface ErrorLogStats {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  resolved: number;
  unresolved: number;
}
