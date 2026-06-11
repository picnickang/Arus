/** Shared visual helpers for the equipment hub page family (dark
 * IntelligenceLayout theme). Extracted verbatim from the pre-split page. */

// Risk → text color now lives in the shared status-colors lib; re-exported
// under its original name for this page family's importers.
export { riskTextClass as riskColor } from "@/lib/status-colors";
export function riskBg(r: string) {
  if (r === "critical") {
    return "bg-red-500/10 border-red-500/20";
  }
  if (r === "warning") {
    return "bg-yellow-500/8 border-yellow-500/15";
  }
  return "bg-green-500/5 border-green-500/10";
}
export function riskBadgeVariant(r: string) {
  if (r === "critical") {
    return "destructive" as const;
  }
  if (r === "warning") {
    return "outline" as const;
  }
  return "secondary" as const;
}
export function healthStroke(v: number) {
  if (v > 70) {
    return "#22c55e";
  }
  if (v > 40) {
    return "#eab308";
  }
  return "#ef4444";
}

/** Dark-theme className overrides for the Radix Tabs primitives. */
export const DARK_TABS_LIST = "bg-white/[0.03] border border-slate-700/20 text-slate-400";
export const DARK_TABS_TRIGGER =
  "text-slate-400 data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-300";

export function HealthRing({
  value,
  size = 72,
  stroke = 6,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  // No PdM score yet — dashed neutral ring instead of a fabricated value.
  if (value == null) {
    return (
      <svg width={size} height={size} data-testid="health-ring-none">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(148,163,184,0.35)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#64748b"
          fontSize={size * 0.28}
          fontWeight={800}
        >
          —
        </text>
      </svg>
    );
  }
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = healthStroke(value);
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)" }}
      data-testid={`health-ring-${value}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size * 0.28}
        fontWeight={800}
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
      >
        {value}
      </text>
    </svg>
  );
}

export function MiniSparkline({
  data,
  color,
  w = 120,
  h = 32,
}: {
  data: number[];
  color: string;
  w?: number;
  h?: number;
}) {
  if (!data || data.length < 2) {
    return null;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    scheduled: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    draft: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    sent: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${variants[status] || "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}
    >
      {status}
    </span>
  );
}

export function SeverityDot({ severity }: { severity?: string | undefined }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-red-500",
    warning: "bg-yellow-500",
    medium: "bg-yellow-500",
    info: "bg-blue-400",
    low: "bg-green-500",
  };
  return <span className={`w-2 h-2 rounded-full ${colors[severity || "info"] || "bg-blue-400"}`} />;
}
