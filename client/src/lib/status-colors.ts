/**
 * Shared status / risk / severity → color-class helpers.
 *
 * IMPORTANT: these are deliberately *named variants*, not one canonical
 * palette. The pages consolidated here key on different vocabularies
 * (critical/warning vs high/medium vs healthy/degraded) and render different
 * kinds of classes (text-*, solid bg-*, tinted badge classes, shadcn Badge
 * variants). Each helper documents its key set and its consumers' expectations;
 * outputs are preserved verbatim from the original local helpers. Do not merge
 * variants or "fix" a mapping without auditing every consumer's rendered
 * classes.
 */

/** Subset of shadcn Badge variants produced by the helpers below. */
type StatusBadgeVariant = "default" | "secondary" | "destructive";

/**
 * Shared shape of the two badge-variant maps: "critical" always renders
 * destructive; exactly one other level renders "secondary"; everything else
 * renders "default".
 */
function badgeVariant(value: string, secondaryKey: string): StatusBadgeVariant {
  if (value === "critical") {
    return "destructive";
  }
  return value === secondaryKey ? "secondary" : "default";
}

/* --------------------------------- Risk --------------------------------- */

/**
 * Risk → text color (equipment-hub page family, dark IntelligenceLayout
 * theme). Keys: "critical" | "warning"; anything else renders healthy green.
 */
export function riskTextClass(r: string): string {
  if (r === "critical") {
    return "text-red-500";
  }
  if (r === "warning") {
    return "text-yellow-500";
  }
  return "text-green-500";
}

/**
 * PdM inference risk level → shadcn Badge variant.
 * Keys: "critical" | "high"; anything else renders "default".
 */
export function riskLevelBadgeVariant(level: string): StatusBadgeVariant {
  return badgeVariant(level, "high");
}

/**
 * RUL risk level → solid background class (RUL cards, paired with
 * `text-white`). Keys: "high" | "medium"; anything else renders green.
 */
export function riskLevelBgClass(level: string): string {
  if (level === "high") {
    return "bg-red-500";
  }
  if (level === "medium") {
    return "bg-yellow-500";
  }
  return "bg-green-500";
}

/* -------------------------------- Status -------------------------------- */

/**
 * Equipment operational status → text color (vessel dashboard).
 * Keys: "operational" | "degraded"/"warning" | "critical"; unknown statuses
 * render neutral slate.
 */
export function equipmentStatusTextClass(s: string): string {
  return s === "operational"
    ? "text-green-500"
    : s === "degraded" || s === "warning"
      ? "text-yellow-500"
      : s === "critical"
        ? "text-red-500"
        : "text-slate-400";
}

/**
 * Fleet-comparison status → shadcn Badge variant (PdM fleet analytics).
 * Keys: "critical" | "warning"; anything else renders "default".
 */
export function comparisonStatusBadgeVariant(status: string): StatusBadgeVariant {
  return badgeVariant(status, "warning");
}

/**
 * Equipment health status → text color (equipment health tab, 600-shade
 * palette). Keys: "healthy" | "warning"; anything else renders the critical
 * red.
 */
export function healthStatusTextClass(status: string): string {
  return status === "healthy"
    ? "text-green-600"
    : status === "warning"
      ? "text-yellow-600"
      : "text-red-600";
}

/**
 * Telemetry pipeline status → tinted outline-badge classes.
 * Keys: "healthy" | "degraded"; anything else renders the destructive tint.
 */
export function telemetryStatusBadgeClass(status: string): string {
  return status === "healthy"
    ? "bg-green-500/10 text-green-500 border-green-500/30"
    : status === "degraded"
      ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
      : "bg-destructive/10 text-destructive border-destructive/30";
}

/* ------------------------------- Severity ------------------------------- */

/**
 * Residual/alert severity → solid background class (digital twin).
 * Keys: "critical" | "warning" | "info"; anything else renders gray.
 */
export function severityBgClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-500";
    case "warning":
      return "bg-yellow-500";
    case "info":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
}
