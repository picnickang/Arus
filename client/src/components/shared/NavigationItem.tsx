import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavigationItem as NavigationItemType } from "@/config/navigationConfig";

interface FindingsSummary {
  pendingApprovals: number;
  pendingSuggestions: number;
  recentFailures: number;
  totalFindings: number;
}

interface BriefingLatest {
  id: string;
  generatedAt: string;
}

function NavBadge({ badgeKey }: { badgeKey: string }) {
  const { data: summary } = useQuery<FindingsSummary>({
    queryKey: ["/api/agent/findings/summary"],
    refetchInterval: 60000,
    enabled: badgeKey === "findings-pending",
  });

  const { data: latestBriefing } = useQuery<BriefingLatest | null>({
    queryKey: ["/api/agent/briefings/latest"],
    refetchInterval: 120000,
    enabled: badgeKey === "briefing-new",
  });

  if (badgeKey === "findings-pending") {
    const count = (summary?.pendingApprovals ?? 0) + (summary?.pendingSuggestions ?? 0);
    if (count === 0) return null;
    return (
      <span
        className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-medium bg-amber-500 text-white"
        data-testid="nav-badge-findings"
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  if (badgeKey === "briefing-new") {
    if (!latestBriefing?.id) return null;
    const viewedId = localStorage.getItem("briefing-viewed-id");
    if (viewedId === latestBriefing.id) return null;
    return (
      <span
        className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-medium bg-blue-500 text-white"
        data-testid="nav-badge-briefing"
      >
        New
      </span>
    );
  }

  return null;
}

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
            {item.badgeKey && <NavBadge badgeKey={item.badgeKey} />}
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
        {item.badgeKey && <NavBadge badgeKey={item.badgeKey} />}
      </Link>
    </>
  );
}
