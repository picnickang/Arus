import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLastVisitTime } from "@/lib/pageTracking";

interface AttentionSummary {
  overdueWorkOrders: number;
  unacknowledgedAlerts: number;
  highRiskEquipment: number;
  newSinceLastVisit?: {
    newAlerts: number;
    newWorkOrders: number;
    completedWorkOrders: number;
  };
}

export function useAttentionItems() {
  const lastVisit = getLastVisitTime();

  const { data: summary } = useQuery<AttentionSummary>({
    queryKey: ["/api/home/attention-summary", lastVisit ? { since: lastVisit } : {}],
    refetchInterval: 60000,
  });

  const attentionItems = useMemo(() => {
    if (!summary) {
      return [];
    }
    const items: Array<{ label: string; count: number; severity: string; href: string }> = [];

    if (summary.overdueWorkOrders > 0) {
      items.push({
        label: "Overdue work orders",
        count: summary.overdueWorkOrders,
        severity: "critical",
        href: "/work-orders?status=overdue",
      });
    }
    if (summary.unacknowledgedAlerts > 0) {
      items.push({
        label: "Unacknowledged alerts",
        count: summary.unacknowledgedAlerts,
        severity: "warning",
        href: "/attention-inbox",
      });
    }
    if (summary.highRiskEquipment > 0) {
      items.push({
        label: "High-risk equipment",
        count: summary.highRiskEquipment,
        severity: "warning",
        href: "/equipment-intelligence",
      });
    }

    return items;
  }, [summary]);

  return { attentionItems, sinceLastVisit: summary?.newSinceLastVisit };
}
