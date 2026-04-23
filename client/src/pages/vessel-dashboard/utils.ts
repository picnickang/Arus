export const statusColor = (s: string) =>
  s === "operational"
    ? "text-green-500"
    : s === "degraded" || s === "warning"
      ? "text-yellow-500"
      : s === "critical"
        ? "text-red-500"
        : "text-slate-400";
