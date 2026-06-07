import { toast } from "@/hooks/use-toast";

const WARNING_DEBOUNCE_MS = 5 * 60 * 1000;
const EXCEEDED_DEBOUNCE_MS = 60 * 1000;

const lastWarningAt = new Map<string, number>();
const lastExceededAt = new Map<string, number>();

const METRIC_LABELS: Record<string, string> = {
  equipment_count: "equipment",
  storage_bytes: "storage",
  telemetry_rows_today: "daily telemetry",
};

function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replace(/_/g, " ");
}

function formatRetryAfter(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {return "shortly";}
  if (seconds < 60) {return `${Math.ceil(seconds)} seconds`;}
  if (seconds < 3600) {return `${Math.ceil(seconds / 60)} minutes`;}
  if (seconds < 86400) {return `${Math.ceil(seconds / 3600)} hours`;}
  return `${Math.ceil(seconds / 86400)} days`;
}

export function inspectQuotaWarning(res: Response): void {
  const metric = res.headers.get("X-Tenant-Quota-Warning");
  if (!metric) {return;}

  const now = Date.now();
  const last = lastWarningAt.get(metric) ?? 0;
  if (now - last < WARNING_DEBOUNCE_MS) {return;}
  lastWarningAt.set(metric, now);

  const ratioHeader = res.headers.get("X-Tenant-Quota-Ratio");
  const ratio = ratioHeader ? Number(ratioHeader) : NaN;
  const pct = Number.isFinite(ratio) ? Math.round(ratio * 100) : null;
  const label = metricLabel(metric);

  toast({
    title: "Tenant quota warning",
    description:
      pct !== null
        ? `You've used ${pct}% of your ${label} quota. Contact your administrator to request more capacity.`
        : `You're approaching your ${label} quota. Contact your administrator to request more capacity.`,
  });
}

export interface QuotaExceededInfo {
  metric: string;
  retryAfterSeconds: number;
  limit?: number | undefined;
  used?: number | undefined;
}

export function parseQuotaExceeded(
  res: Response,
  body: unknown
): QuotaExceededInfo | null {
  if (res.status !== 429) {return null;}

  const headerMetric = res.headers.get("X-Tenant-Quota-Exceeded");
  const bodyRecord =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : undefined;
  const code = bodyRecord?.['code'];
  const metricFromBody =
    typeof bodyRecord?.['metric'] === "string" ? (bodyRecord['metric']) : undefined;

  if (!headerMetric && code !== "TENANT_QUOTA_EXCEEDED") {return null;}

  const metric = headerMetric ?? metricFromBody ?? "quota";
  const retryHeader = res.headers.get("Retry-After");
  const retryFromBody =
    typeof bodyRecord?.['retryAfterSeconds'] === "number"
      ? (bodyRecord['retryAfterSeconds'])
      : undefined;
  const retryAfterSeconds = retryHeader
    ? Number(retryHeader)
    : retryFromBody ?? 60;

  return {
    metric,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 60,
    limit: typeof bodyRecord?.['limit'] === "number" ? (bodyRecord['limit']) : undefined,
    used: typeof bodyRecord?.['used'] === "number" ? (bodyRecord['used']) : undefined,
  };
}

export function notifyQuotaExceeded(info: QuotaExceededInfo): void {
  const now = Date.now();
  const last = lastExceededAt.get(info.metric) ?? 0;
  if (now - last < EXCEEDED_DEBOUNCE_MS) {return;}
  lastExceededAt.set(info.metric, now);

  const label = metricLabel(info.metric);
  const wait = formatRetryAfter(info.retryAfterSeconds);

  toast({
    variant: "destructive",
    title: `${label.charAt(0).toUpperCase()}${label.slice(1)} quota exceeded`,
    description: `Your tenant has hit its ${label} limit. New requests will be rejected for the next ${wait}. Contact your administrator to raise the limit.`,
  });
}

export function formatQuotaExceededMessage(info: QuotaExceededInfo): string {
  const label = metricLabel(info.metric);
  const wait = formatRetryAfter(info.retryAfterSeconds);
  return `Your tenant ${label} quota is exhausted. Try again in ${wait} or contact your administrator to raise the limit.`;
}
