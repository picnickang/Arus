import { Link, useLocation } from "wouter";
import { Home, Activity, Users, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/operations", label: "Operations", icon: Activity },
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/system", label: "System", icon: Settings },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t md:hidden pb-safe" data-testid="bottom-nav">
      <div className="flex items-center justify-around h-14 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <div className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                <Icon className={cn("h-5 w-5", active && "fill-primary/20")} />
                <span className="text-[10px] font-medium">{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
