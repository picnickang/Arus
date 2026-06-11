import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OpsShellProps {
  sidebar?: ReactNode;
  topBar?: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Layout shell for the ARUS command-center surface. Pure presentation
 * — does not decide what to render in any slot. Pass already-composed
 * elements for the sidebar (desktop), top bar, mobile bottom nav, and
 * page body. Layout is mobile-first; the sidebar collapses on small
 * screens.
 */
export function OpsShell({
  sidebar,
  topBar,
  bottomNav,
  children,
  className,
  testId,
}: OpsShellProps) {
  return (
    <div
      className={cn(
        "ops-surface flex min-h-screen w-full bg-background text-foreground",
        className
      )}
      data-testid={testId ?? "ops-shell"}
    >
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topBar}
        <main
          className="ops-safe-bottom flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pb-8"
          data-testid="ops-shell-main"
        >
          {children}
        </main>
        {bottomNav}
      </div>
    </div>
  );
}

export default OpsShell;
