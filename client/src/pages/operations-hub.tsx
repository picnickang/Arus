import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Gauge, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface FindingsSummary {
  pendingApprovals: number;
  pendingSuggestions: number;
  recentFailures: number;
  totalFindings: number;
}

function FindingsBadge() {
  const { data: summary } = useQuery<FindingsSummary>({
    queryKey: ["/api/agent/findings/summary"],
    refetchInterval: 60000,
  });
  const pending = (summary?.pendingApprovals ?? 0) + (summary?.pendingSuggestions ?? 0);
  if (pending === 0) return null;
  return (
    <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] bg-amber-500 text-white border-0" data-testid="badge-findings-count">
      {pending > 99 ? "99+" : pending}
    </Badge>
  );
}

const operationsItems: GridItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    description: "Fleet overview, alerts, telemetry & insights",
    load: () => import("./dashboard-improved"),
    loaderVariant: "cards",
    legacyRoutes: ["/dashboard", "/alerts"],
  },
  {
    id: "findings",
    label: "Agent Findings",
    icon: Eye,
    description: "AI agent activity feed",
    load: () => import("./findings"),
    loaderVariant: "cards",
  },
];

export default function OperationsHub() {
  return (
    <IconGridLayout
      title="Operations"
      description="Dashboard, telemetry, and insights"
      items={operationsItems}
      defaultItemId="dashboard"
      baseRoute="/operations"
      badgeRenderer={(itemId) => itemId === "findings" ? <FindingsBadge /> : null}
    />
  );
}
