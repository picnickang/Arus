import {
  DECK_Y,
  HULL_LEFT,
  HULL_RIGHT,
  SUPER_BOTTOM,
  SUPER_LEFT,
  SUPER_RIGHT,
  SUPER_TOP,
  SVG_H,
  SVG_W,
  WATERLINE_Y,
  hullBottomAt,
  hullPath,
  hullTopAt,
} from "./constants";
import type { ZoneRect } from "./types";

export function HullSVG({ zoneRects }: { zoneRects: ZoneRect[] }) {
  return (
    <>
      <defs>
        <linearGradient id="hull-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2744" />
          <stop offset="100%" stopColor="#0d1829" />
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(56,189,248,0.05)" />
          <stop offset="50%" stopColor="rgba(56,189,248,0.12)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0.05)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="hull-clip">
          <path d={hullPath()} />
        </clipPath>
      </defs>

      <rect x="0" y={WATERLINE_Y} width={SVG_W} height={SVG_H - WATERLINE_Y} fill="url(#water)" />

      <path
        d={hullPath()}
        fill="url(#hull-grad)"
        stroke="rgba(56,189,248,0.25)"
        strokeWidth="0.4"
      />

      <line
        x1={HULL_LEFT}
        y1={WATERLINE_Y}
        x2={HULL_RIGHT}
        y2={WATERLINE_Y}
        stroke="rgba(56,189,248,0.15)"
        strokeWidth="0.3"
        strokeDasharray="2 1.5"
      />

      <line
        x1={HULL_LEFT + 5}
        y1={DECK_Y}
        x2={SUPER_LEFT}
        y2={DECK_Y}
        stroke="rgba(148,163,184,0.12)"
        strokeWidth="0.25"
        strokeDasharray="1.5 1"
      />

      <rect
        x={SUPER_LEFT}
        y={SUPER_TOP}
        width={SUPER_RIGHT - SUPER_LEFT}
        height={SUPER_BOTTOM - SUPER_TOP}
        rx="1.5"
        fill="#15243d"
        stroke="rgba(56,189,248,0.2)"
        strokeWidth="0.3"
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={SUPER_LEFT + 2 + i * 8}
          y={SUPER_TOP + 2}
          width={6}
          height={3}
          rx={0.5}
          fill="rgba(56,189,248,0.3)"
        />
      ))}

      <line
        x1={SUPER_LEFT + 17}
        y1={SUPER_TOP - 5}
        x2={SUPER_LEFT + 17}
        y2={SUPER_TOP}
        stroke="rgba(148,163,184,0.4)"
        strokeWidth="0.4"
      />
      <circle cx={SUPER_LEFT + 17} cy={SUPER_TOP - 5.5} r="0.8" fill="#f59e0b" opacity={0.8}>
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>

      {zoneRects.map(
        (zr, i) =>
          i > 0 && (
            <line
              key={`div-${i}`}
              x1={zr.x}
              y1={Math.max(hullTopAt(zr.x), SUPER_TOP) + 0.5}
              x2={zr.x}
              y2={hullBottomAt(zr.x) - 0.5}
              stroke="rgba(148,163,184,0.18)"
              strokeWidth="0.5"
              strokeDasharray="2 1"
            />
          )
      )}

      {zoneRects.map((zr) => (
        <text
          key={`zl-${zr.zone.zoneId}`}
          x={zr.x + zr.w / 2}
          y={zr.y + zr.h - 1.5}
          textAnchor="middle"
          fill="rgba(148,163,184,0.18)"
          fontSize="2.5"
          fontWeight="700"
          fontFamily="monospace"
          style={{ textTransform: "uppercase" as const }}
        >
          {zr.zone.label}
        </text>
      ))}
    </>
  );
}
