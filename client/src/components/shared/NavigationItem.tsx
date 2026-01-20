import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavigationItem as NavigationItemType } from "@/config/navigationConfig";

interface NavigationItemProps {
  item: NavigationItemType;
  mode?: "desktop" | "mobile";
  onNavigate?: () => void;
}

export function NavigationItem({ item, mode = "desktop", onNavigate }: NavigationItemProps) {
  const [location] = useLocation();
  const isActive = location === item.href;
  const Icon = item.icon;

  if (mode === "mobile") {
    return (
      <>
        {item.divider && <div className="border-t border-border my-2 mx-4" />}
        <Link href={item.href}>
          <Button
            variant={isActive ? "secondary" : "ghost"}
            className="w-full justify-start px-4 py-2.5 touch-manipulation"
            onClick={onNavigate}
            data-testid={`mobile-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className="h-4 w-4 mr-3" />
            <span className="text-sm">{item.name}</span>
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      {item.divider && <div className="border-t border-sidebar-border my-2 mx-6" />}
      <Link
        href={item.href}
        className={cn(
          "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
          "mx-3 my-0.5",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <Icon className="w-4 h-4 mr-3" />
        {item.name}
      </Link>
    </>
  );
}
