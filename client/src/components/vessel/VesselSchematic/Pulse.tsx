export function Pulse({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full animate-ping"
        style={{ backgroundColor: color, opacity: 0.6 }}
      />
      <span
        className="relative block rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    </span>
  );
}
