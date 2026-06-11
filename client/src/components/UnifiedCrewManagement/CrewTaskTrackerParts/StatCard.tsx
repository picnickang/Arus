import type { ReactNode } from "react";

export function StatCard({
  icon,
  value,
  label,
  tone,
  testId,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  tone: string;
  testId: string;
}) {
  return (
    <div className="ops-card flex items-center gap-3 rounded-2xl p-3" data-testid={testId}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-white">{value}</p>
        <p className="mt-1 text-sm font-medium text-slate-200">{label}</p>
      </div>
    </div>
  );
}
