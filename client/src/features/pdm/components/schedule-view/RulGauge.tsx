export function RulGauge({ p10, p50, p90 }: { p10: number; p50: number; p90: number }) {
  const maxDays = Math.max(p90, 30);
  const p10Pct = (p10 / maxDays) * 100;
  const p50Pct = (p50 / maxDays) * 100;
  const p90Pct = (p90 / maxDays) * 100;

  const getColor = (days: number) => {
    if (days <= 7) {
      return "bg-red-500";
    }
    if (days <= 14) {
      return "bg-orange-500";
    }
    if (days <= 21) {
      return "bg-yellow-500";
    }
    return "bg-green-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>P10: {p10}d</span>
        <span className="font-medium">P50: {p50}d</span>
        <span>P90: {p90}d</span>
      </div>
      <div className="relative h-4 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-red-200 dark:bg-red-900/50"
          style={{ left: `${p10Pct}%`, width: `${p90Pct - p10Pct}%` }}
        />
        <div
          className={`absolute h-full w-1 ${getColor(p50)}`}
          style={{ left: `${p50Pct}%`, transform: "translateX(-50%)" }}
        />
        <div
          className="absolute h-full w-0.5 bg-muted-foreground/50"
          style={{ left: `${p10Pct}%` }}
        />
        <div
          className="absolute h-full w-0.5 bg-muted-foreground/50"
          style={{ left: `${p90Pct}%` }}
        />
      </div>
      <div className="text-xs text-center text-muted-foreground">RUL Confidence Bands (days)</div>
    </div>
  );
}
