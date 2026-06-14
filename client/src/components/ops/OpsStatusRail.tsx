import React from "react";

interface RiskItem {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  confidence?: number;
}

interface OpsStatusRailProps {
  risks?: RiskItem[];
  outboxCount?: number;
  outboxHasConflict?: boolean;
  handoverMinutes?: number;
  isVesselLocal?: boolean;
  cachedSensors?: number;
  onAction?: (action: string, payload?: unknown) => void;
  className?: string;
}

/**
 * Persistent Ops Status Rail
 * Phase 1 remediation for P0: Always-visible critical operational info
 * Compliant with S-Mode / IEC 62288 visibility principles
 */
const OpsStatusRail: React.FC<OpsStatusRailProps> = ({
  risks = [],
  outboxCount = 0,
  outboxHasConflict = false,
  handoverMinutes,
  isVesselLocal = true,
  cachedSensors = 0,
  onAction,
  className = "",
}) => {
  const hasCritical = risks.some((r) => r.severity === "high");
  const topRisk = risks[0];

  return (
    <div
      className={`w-full bg-zinc-900/95 border-b border-amber-500/30 px-4 py-2 flex items-center gap-3 text-sm overflow-x-auto whitespace-nowrap ${className}`}
      role="region"
      aria-label="Persistent operational status rail"
    >
      {/* Highest Priority Risk / AI Finding */}
      {topRisk && (
        <div className="flex items-center gap-2 bg-red-950/70 border border-red-500/60 rounded-lg px-3 py-1.5 text-red-300 flex-shrink-0">
          <span className="text-base" aria-hidden="true">
            🔴
          </span>
          <span className="font-medium">{topRisk.label}</span>
          {topRisk.confidence && (
            <span className="text-xs text-red-400/80">{topRisk.confidence}%</span>
          )}
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => onAction?.("accept-risk", topRisk)}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label={`Accept work order for ${topRisk.label}`}
            >
              Accept WO
            </button>
            <button
              onClick={() => onAction?.("snooze-risk", topRisk)}
              className="px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs rounded transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              Snooze
            </button>
          </div>
        </div>
      )}

      {/* Offline Outbox Status */}
      {outboxCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-950/70 border border-amber-500/60 rounded-lg px-3 py-1.5 text-amber-300 flex-shrink-0">
          <span className="text-base" aria-hidden="true">
            📤
          </span>
          <span>
            {outboxCount} item{outboxCount > 1 ? "s" : ""}
            {outboxHasConflict && <span className="text-amber-400"> (1 conflict)</span>}
          </span>
          <button
            onClick={() => onAction?.("review-outbox")}
            className="ml-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="Review offline outbox queue"
          >
            Review
          </button>
        </div>
      )}

      {/* Handover / Next Action */}
      {handoverMinutes !== undefined && (
        <div className="flex items-center gap-2 bg-blue-950/70 border border-blue-500/60 rounded-lg px-3 py-1.5 text-blue-300 flex-shrink-0">
          <span className="text-base" aria-hidden="true">
            🔀
          </span>
          <span>Handover in {handoverMinutes} min</span>
          <button
            onClick={() => onAction?.("open-handover-briefing")}
            className="ml-2 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Open handover briefing"
          >
            Briefing
          </button>
        </div>
      )}

      {/* Vessel / Mode Status - always visible */}
      <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-600 rounded-lg px-3 py-1.5 text-zinc-400 flex-shrink-0 ml-auto">
        <span>{isVesselLocal ? "🛳️ Vessel-Local" : "☁️ Cloud"}</span>
        {cachedSensors > 0 && (
          <span className="text-xs text-emerald-400/80">• {cachedSensors} cached</span>
        )}
        <button
          onClick={() => onAction?.("refresh-status")}
          className="ml-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Refresh status"
        >
          ⟳
        </button>
      </div>
    </div>
  );
};

export default OpsStatusRail;
