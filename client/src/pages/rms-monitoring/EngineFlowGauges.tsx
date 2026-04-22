import { useMemo } from "react";
import type { HourlyConsumption } from "./_shared";

export function EngineFlowGauges({ consumption }: { consumption: HourlyConsumption[] }) {
  const latestReadings = useMemo(() => {
    if (!consumption || consumption.length === 0) {
      return [];
    }
    const latest = consumption[consumption.length - 1];
    return [
      {
        key: "mainEngine",
        label: "Main Engine",
        icon: "⚙️",
        flow: latest?.main_engine_flow,
        max: 2000,
      },
      {
        key: "portEngine",
        label: "Port Engine",
        icon: "◀",
        flow: latest?.port_engine_flow,
        max: 1500,
      },
      {
        key: "stbdEngine",
        label: "Stbd Engine",
        icon: "▶",
        flow: latest?.stbd_engine_flow,
        max: 1500,
      },
      { key: "generator", label: "Generator", icon: "🔌", flow: latest?.generator_flow, max: 500 },
      { key: "boiler", label: "Boiler", icon: "🔥", flow: latest?.boiler_flow, max: 300 },
      { key: "total", label: "Total", icon: "∑", flow: latest?.avg_flow_kg_per_h, max: 5000 },
    ];
  }, [consumption]);

  if (latestReadings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No engine flow data available
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {latestReadings.map((engine) => {
        const flow = engine.flow ? parseFloat(engine.flow) : 0;
        const pct = Math.min((flow / engine.max) * 100, 100);
        const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500";
        return (
          <div
            key={engine.key}
            className="p-3 rounded-lg border space-y-2"
            data-testid={`gauge-${engine.key}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {engine.icon} {engine.label}
              </span>
            </div>
            <div className="text-lg font-bold font-mono">
              {flow > 0 ? `${flow.toFixed(0)}` : "--"}{" "}
              <span className="text-xs font-normal text-muted-foreground">kg/h</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
