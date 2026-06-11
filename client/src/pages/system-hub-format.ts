/**
 * Pure formatting/derivation helpers for the System hub overview.
 *
 * Mirrors `HealthCheckResult` from `server/routes/diagnostics/types.ts`.
 * `checks.{database,telemetry,memory}` carry pass/warn/fail;
 * `checks.services` is an array of `{name, status}` where `status` is
 * running/stopped/error. The endpoint returns HTTP 503 with a populated
 * body when degraded / unhealthy, so the page reads the body regardless
 * of status (see `healthQueryFn` in `system-hub.tsx`).
 */
// Deliberately loose: this parses an untrusted health body (the endpoint returns
// HTTP 503 with a populated body when degraded), so every field is optional and
// `status` accepts arbitrary strings. Distinct from the strict server-side
// DiagnosticsCheckResult; named separately to avoid a false-positive duplicate.
export interface HealthCheckEntry {
  status?: "pass" | "warn" | "fail" | string;
  message?: string;
  responseTimeMs?: number;
}

export interface ServiceStatusEntry {
  name: string;
  status?: "running" | "stopped" | "error" | string;
}

export interface HealthResponse {
  status?: "healthy" | "degraded" | "unhealthy" | string;
  uptime?: number;
  checks?: {
    database?: HealthCheckEntry;
    telemetry?: HealthCheckEntry;
    memory?: HealthCheckEntry;
    services?: ServiceStatusEntry[];
  };
}

const SERVICE_LABELS: Record<string, string> = {
  database: "Database",
  telemetry: "Telemetry",
  memory: "Memory",
};

const HEALTHY_STATUSES = new Set(["healthy", "ok", "up", "operational", "pass", "running"]);
const WARN_STATUSES = new Set(["degraded", "warning", "warn"]);
const FAIL_STATUSES = new Set(["unhealthy", "down", "error", "fail", "stopped"]);

export function statusTone(status: string | undefined): {
  dot: string;
  text: string;
  label: string;
} {
  const s = (status ?? "").toLowerCase();
  if (HEALTHY_STATUSES.has(s)) {
    return { dot: "bg-emerald-500", text: "text-emerald-600", label: "Operational" };
  }
  if (WARN_STATUSES.has(s)) {
    return { dot: "bg-amber-500", text: "text-amber-600", label: "Degraded" };
  }
  if (FAIL_STATUSES.has(s)) {
    return { dot: "bg-rose-500", text: "text-rose-600", label: "Down" };
  }
  return { dot: "bg-slate-400", text: "text-slate-500", label: status ?? "Unknown" };
}

export interface ServiceCardData {
  key: string;
  label: string;
  status?: string | undefined;
}

export function flattenServiceCards(health: HealthResponse | undefined): ServiceCardData[] {
  const checks = health?.checks;
  if (!checks) {
    return [];
  }
  const cards: ServiceCardData[] = [];
  for (const key of ["database", "telemetry", "memory"] as const) {
    const check = checks[key];
    if (check) {
      cards.push({
        key,
        label: SERVICE_LABELS[key] ?? key,
        status: check.status,
      });
    }
  }
  for (const svc of checks.services ?? []) {
    cards.push({ key: svc.name, label: svc.name, status: svc.status });
  }
  return cards;
}

export function isOperational(status: string | undefined): boolean {
  return HEALTHY_STATUSES.has((status ?? "").toLowerCase());
}

export function formatUptime(seconds: number | undefined): string {
  if (!seconds || Number.isNaN(seconds)) {
    return "—";
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
