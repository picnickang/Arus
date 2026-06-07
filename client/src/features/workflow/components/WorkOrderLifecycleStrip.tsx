import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

const stages = [
  "Created",
  "Planned",
  "Parts Ready",
  "In Progress",
  "Verification",
  "Closed",
] as const;

function activeIndex(status?: string): number {
  const normalized = status?.toLowerCase().replace(/[_-]/g, " ") ?? "";
  if (normalized.includes("closed") || normalized.includes("complete")) {return 5;}
  if (normalized.includes("verify") || normalized.includes("review") || normalized.includes("ready")) {return 4;}
  if (normalized.includes("progress")) {return 3;}
  if (normalized.includes("part")) {return 2;}
  if (normalized.includes("plan") || normalized.includes("schedule")) {return 1;}
  return 0;
}

export function WorkOrderLifecycleStrip({ status }: { status?: string }) {
  const current = activeIndex(status);

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      {stages.map((stage, index) => {
        const done = index < current;
        const active = index === current;
        const Icon = done ? CheckCircle2 : active ? CircleDot : Circle;
        return (
          <div
            key={stage}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2 py-2 text-xs",
              active && "border-primary bg-primary/5",
              done && "border-emerald-500/40"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{stage}</span>
          </div>
        );
      })}
    </div>
  );
}
