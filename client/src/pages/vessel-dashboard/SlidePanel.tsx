import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function SlidePanel({
  open,
  onClose,
  side,
  children,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}
      <div
        className={`fixed top-0 ${side === "left" ? "left-0" : "right-0"} h-full w-[300px] sm:w-[340px] bg-[#0a1120] border-${side === "left" ? "r" : "l"} border-slate-700/20 z-50 transform transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full"
        }`}
        data-testid={testId}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/15">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {side === "left" ? "Vessel Status" : "Inventory"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            data-testid={testId ? `${testId}-close` : undefined}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-49px)]">{children}</div>
      </div>
    </>
  );
}
