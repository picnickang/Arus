import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { buildMobileReadinessNavigationForVariant } from "./mobile-readiness-model";
import { pickNavVariant, readRoleHint } from "./MobileReadinessShared";

export function MobileBottomNav() {
  const roleHint = readRoleHint();
  const [location] = useLocation();
  const currentPath = location.split("?")[0] ?? "/";
  const variant = pickNavVariant(location);
  const nav = buildMobileReadinessNavigationForVariant(variant, roleHint);
  const usesReferenceTabBar = variant === "technician";
  const isActive = (href: string) =>
    href === "/" ? currentPath === "/" : currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t pb-safe shadow-[0_-12px_24px_-18px_rgba(3,41,90,0.35)] md:hidden",
        usesReferenceTabBar
          ? "border-slate-200 bg-white text-slate-600"
          : "border-brand-navy-700 bg-brand-navy text-white"
      )}
      aria-label="Mobile readiness navigation"
      data-testid="mobile-readiness-bottom-nav"
      data-nav-variant={variant}
    >
      <div
        className="mx-auto grid h-16 max-w-md px-2"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold",
                usesReferenceTabBar
                  ? active
                    ? "text-brand-navy"
                    : "text-slate-500"
                  : active
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-blue-100"
              )}
              data-testid={`mobile-readiness-nav-${item.id}`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
