import React from "react";

interface ActionCardProps {
  title: string;
  description?: string;
  severity: "high" | "medium" | "low";
  confidence?: number;
  source?: string;
  timestamp?: string;
  isCached?: boolean;
  onAccept?: () => void;
  onSnooze?: () => void;
  onAssign?: () => void;
  onDetails?: () => void;
  className?: string;
}

/**
 * Standardized ActionCard
 * Phase 2: Consistent, high-actionability card for AI recs, risks, handovers etc.
 * Aligned with IEC 62288 / S-Mode / OpenBridge principles.
 */
const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  severity,
  confidence,
  source = "AI",
  timestamp,
  isCached = false,
  onAccept,
  onSnooze,
  onAssign,
  onDetails,
  className = "",
}) => {
  const severityConfig = {
    high: { color: "red", icon: "🔴", label: "HIGH" },
    medium: { color: "amber", icon: "🟠", label: "MEDIUM" },
    low: { color: "emerald", icon: "🟢", label: "LOW" },
  };

  const config = severityConfig[severity];

  return (
    <div
      className={`bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            {config.icon}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded bg-${config.color}-950 text-${config.color}-400`}
              >
                {config.label}
              </span>
              {confidence && (
                <span className="text-xs text-zinc-400">{confidence}% confidence</span>
              )}
            </div>
            <h3 className="font-semibold text-white text-[15px] leading-tight mt-0.5">{title}</h3>
          </div>
        </div>
        {timestamp && <span className="text-xs text-zinc-500 whitespace-nowrap">{timestamp}</span>}
      </div>

      {/* Description */}
      {description && <div className="px-4 pb-3 text-sm text-zinc-300">{description}</div>}

      {/* Fixed Action Bar */}
      <div className="border-t border-zinc-700 bg-zinc-950/50 px-3 py-2 flex flex-wrap gap-2">
        {onAccept && (
          <button
            onClick={onAccept}
            className="flex-1 min-w-[110px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            ✅ Accept / Schedule
          </button>
        )}
        {onSnooze && (
          <button
            onClick={onSnooze}
            className="flex-1 min-w-[90px] px-4 py-2.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            ⏰ Snooze
          </button>
        )}
        {onAssign && (
          <button
            onClick={onAssign}
            className="flex-1 min-w-[90px] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            👷 Assign
          </button>
        )}
        {onDetails && (
          <button
            onClick={onDetails}
            className="px-3 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition flex items-center justify-center"
          >
            📋 Details
          </button>
        )}
      </div>

      {/* Footer indicators */}
      <div className="px-4 py-1.5 flex items-center justify-between text-xs text-zinc-500 bg-zinc-950/30">
        <div className="flex items-center gap-2">
          <span>{source}</span>
          {isCached && <span className="text-emerald-400">• Cached</span>}
        </div>
        {timestamp && <span>{timestamp}</span>}
      </div>
    </div>
  );
};

export default ActionCard;
