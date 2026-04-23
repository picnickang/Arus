import type { SlotAssignment } from "./types";
import { statusFill } from "./utils";

export function SlotRect({
  assignment,
  isSelected,
  onClick,
}: {
  assignment: SlotAssignment;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { slot, equipment: eq } = assignment;
  const status = eq?.status || "offline";
  const sc = eq ? statusFill(status) : "rgba(148,163,184,0.3)";
  const health = eq?.healthScore ?? 0;
  const displayName = eq
    ? eq.name.length > 14
      ? `${eq.name.slice(0, 12)}\u2026`
      : eq.name
    : slot.label;
  const displaySub = eq
    ? [eq.manufacturer, eq.model].filter(Boolean).join(" ").slice(0, 16)
    : "EMPTY SLOT";

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }} data-testid={`slot-${slot.slotId}`}>
      <rect
        x={slot.x}
        y={slot.y}
        width={slot.w}
        height={slot.h}
        rx={1}
        fill={isSelected ? `${sc}22` : eq ? `${sc}10` : "rgba(148,163,184,0.03)"}
        stroke={isSelected ? sc : eq ? `${sc}66` : "rgba(148,163,184,0.15)"}
        strokeWidth={isSelected ? 0.7 : 0.35}
        strokeDasharray={!eq ? "1.2 0.8" : "none"}
        className="transition-all duration-200"
      />

      {eq && (
        <circle cx={slot.x + slot.w - 2} cy={slot.y + 2} r={1} fill={sc} filter="url(#glow)">
          {status === "critical" && (
            <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
          )}
        </circle>
      )}

      {eq && (
        <>
          <rect
            x={slot.x + 0.8}
            y={slot.y + 0.8}
            width={4.5}
            height={1.8}
            rx={0.5}
            fill="rgba(34,197,94,0.2)"
            stroke="rgba(34,197,94,0.35)"
            strokeWidth="0.12"
          />
          <text
            x={slot.x + 3.05}
            y={slot.y + 2}
            textAnchor="middle"
            fill="#22c55e"
            fontSize="0.95"
            fontWeight="700"
            fontFamily="monospace"
          >
            OK
          </text>
        </>
      )}

      <text
        x={slot.x + slot.w / 2}
        y={slot.y + slot.h / 2 - (eq ? 0.3 : 0)}
        textAnchor="middle"
        fill={eq ? "rgba(226,232,240,0.9)" : "rgba(148,163,184,0.5)"}
        fontSize="1.8"
        fontWeight={eq ? "600" : "400"}
        fontFamily="system-ui"
      >
        {displayName}
      </text>

      <text
        x={slot.x + slot.w / 2}
        y={slot.y + slot.h / 2 + 1.8}
        textAnchor="middle"
        fill="rgba(148,163,184,0.5)"
        fontSize="1.2"
        fontFamily="monospace"
      >
        {displaySub}
      </text>

      {eq && (
        <>
          <rect
            x={slot.x + 1.2}
            y={slot.y + slot.h - 2.2}
            width={slot.w - 2.4}
            height={0.9}
            rx={0.4}
            fill="rgba(255,255,255,0.06)"
          />
          <rect
            x={slot.x + 1.2}
            y={slot.y + slot.h - 2.2}
            width={((slot.w - 2.4) * health) / 100}
            height={0.9}
            rx={0.4}
            fill={sc}
            opacity={0.7}
          />
        </>
      )}
    </g>
  );
}
