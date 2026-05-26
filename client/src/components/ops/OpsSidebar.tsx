import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface OpsSidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: ReactNode;
  isActive?: boolean;
}

export interface OpsSidebarProps {
  brand?: ReactNode;
  items: OpsSidebarItem[];
  footer?: ReactNode;
  className?: string;
  testId?: string;
}

export function OpsSidebar({
  brand,
  items,
  footer,
  className,
  testId,
}: OpsSidebarProps) {
  return (
    <aside
      className={cn(
        "ops-sidebar hidden h-full w-60 shrink-0 flex-col border-r border-border/60 px-3 py-4 md:flex",
        className,
      )}
      data-testid={testId ?? "ops-sidebar"}
      aria-label="Primary"
    >
      {brand ? <div className="mb-4 px-2">{brand}</div> : null}
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <Link key={item.id} href={item.href}>
            <a
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                item.isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
              )}
              data-testid={`ops-sidebar-item-${item.id}`}
              aria-current={item.isActive ? "page" : undefined}
            >
              {item.icon ? (
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center",
                    item.isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {item.icon}
                </span>
              ) : null}
              <span className="truncate">{item.label}</span>
              {item.badge ? <span className="ml-auto">{item.badge}</span> : null}
            </a>
          </Link>
        ))}
      </nav>
      {footer ? <div className="mt-3 border-t border-border/60 pt-3">{footer}</div> : null}
    </aside>
  );
}

export default OpsSidebar;
