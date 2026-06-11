import type { ReactNode } from "react";

export function CounterTile({
  icon,
  value,
  label,
  tone,
  onClick,
  testId,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ops-card flex items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:border-sky-500/40"
      data-testid={testId}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-white">{value}</p>
        <p className="mt-1 text-sm font-medium text-slate-200">{label}</p>
      </div>
    </button>
  );
}
