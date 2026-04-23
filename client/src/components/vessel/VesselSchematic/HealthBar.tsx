import { healthColor } from "./utils";

export function HealthBar({
  value,
  width = 100,
  height = 6,
}: {
  value: number;
  width?: number;
  height?: number;
}) {
  const color = healthColor(value);
  return (
    <svg width={width} height={height} className="rounded overflow-hidden">
      <rect width={width} height={height} fill="currentColor" className="text-white/5" rx={3} />
      <rect width={(width * value) / 100} height={height} fill={color} rx={3}>
        <animate
          attributeName="width"
          from="0"
          to={String((width * value) / 100)}
          dur="0.8s"
          fill="freeze"
        />
      </rect>
    </svg>
  );
}
