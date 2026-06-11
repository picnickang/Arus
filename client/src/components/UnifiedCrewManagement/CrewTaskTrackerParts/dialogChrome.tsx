import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  tone = "default",
  testId,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary";
  testId: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50";
  const cls =
    tone === "primary"
      ? `${base} bg-emerald-500/90 text-white hover:bg-emerald-500`
      : `${base} ops-card text-slate-200 hover:border-sky-500/40`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls}
      data-testid={testId}
    >
      {icon}
      {label}
    </button>
  );
}

export function Overlay({
  title,
  children,
  onClose,
  testId,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  testId: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      data-testid={testId}
    >
      <div
        className="ops-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-400 hover:text-white"
            data-testid="button-close-dialog"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
