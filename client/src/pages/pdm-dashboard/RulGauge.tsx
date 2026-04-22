import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

export function RulGauge({
  rulDays,
  confidence,
  confidenceInterval,
}: {
  rulDays: number | null;
  confidence: number;
  confidenceInterval?: { lowDays: number; highDays: number } | null;
}) {
  if (rulDays === null) {
    return (
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">RUL data not available</p>
      </div>
    );
  }

  const maxDays = 60;
  const normalizedRul = Math.min(rulDays / maxDays, 1);
  const getColor = (days: number) => {
    if (days < 7) {
      return "#ef4444";
    }
    if (days < 14) {
      return "#f97316";
    }
    if (days < 30) {
      return "#eab308";
    }
    return "#22c55e";
  };

  const mainColor = getColor(rulDays);

  const p90Pct = confidenceInterval
    ? Math.min(confidenceInterval.highDays / maxDays, 1) * 100
    : normalizedRul * 100;
  const p10Pct = confidenceInterval
    ? Math.min(confidenceInterval.lowDays / maxDays, 1) * 100
    : normalizedRul * 100;
  const medianPct = normalizedRul * 100;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart
          cx="50%"
          cy="100%"
          innerRadius="55%"
          outerRadius="100%"
          barSize={14}
          data={[{ name: "Base", value: 100, fill: "hsl(var(--muted))" }]}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar dataKey="value" cornerRadius={6} />
        </RadialBarChart>
      </ResponsiveContainer>

      {confidenceInterval && (
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              cx="50%"
              cy="100%"
              innerRadius="55%"
              outerRadius="100%"
              barSize={14}
              data={[{ name: "P90", value: p90Pct, fill: `${mainColor}25` }]}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar dataKey="value" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}

      {confidenceInterval && (
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              cx="50%"
              cy="100%"
              innerRadius="55%"
              outerRadius="100%"
              barSize={14}
              data={[{ name: "P10", value: p10Pct, fill: "hsl(var(--muted))" }]}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar dataKey="value" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height={160}>
          <RadialBarChart
            cx="50%"
            cy="100%"
            innerRadius="60%"
            outerRadius="95%"
            barSize={8}
            data={[{ name: "Median", value: medianPct, fill: mainColor }]}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar dataKey="value" cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      <div className="absolute inset-x-0 bottom-6 text-center">
        <p
          className="text-2xl font-bold"
          style={{ color: mainColor }}
          data-testid="rul-gauge-value"
        >
          {confidenceInterval
            ? `${confidenceInterval.lowDays}-${confidenceInterval.highDays}`
            : rulDays}
        </p>
        <p className="text-xs text-muted-foreground">Days (P10-P90)</p>
      </div>

      <div className="flex justify-center gap-4 mt-1">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Confidence</p>
          <p className="text-sm font-semibold">{confidence}%</p>
        </div>
        {confidenceInterval && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Median (P50)</p>
            <p className="text-sm font-semibold">{rulDays}d</p>
          </div>
        )}
      </div>

      {confidenceInterval && (
        <div className="flex justify-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: `${mainColor}25` }}></span>
            P10-P90
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: mainColor }}></span>
            Median
          </span>
        </div>
      )}
    </div>
  );
}
