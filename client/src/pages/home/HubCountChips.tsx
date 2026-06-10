/**
 * Live count chips for the Admin Hubs launcher (home.tsx). Each chip is a
 * drill-down: the number deep-links to the pre-filtered list it was counted
 * from (work-order URL filters shipped in the density phase-2 work, the
 * logistics low-stock filter, the fleet risk list). Counts come from
 * endpoints the hubs already serve — no new backend routes.
 *
 * Chips render as buttons (not Links) because the whole hub card is already
 * wrapped in a Link — nesting anchors is invalid HTML and double-navigates.
 */

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface WorkOrderSummary {
  open?: number;
  openCount?: number;
  overdue?: number;
  overdueCount?: number;
}

interface FleetOverview {
  fleet?: { criticalCount?: number };
}

interface LowStockResponse {
  total?: number;
  suggestions?: unknown[];
}

interface Chip {
  key: string;
  label: string;
  href: string;
  tone: "red" | "amber" | "slate";
}

const TONE_CLASSES: Record<Chip["tone"], string> = {
  red: "bg-red-500/15 text-red-400",
  amber: "bg-amber-500/15 text-amber-400",
  slate: "bg-white/10 text-muted-foreground",
};

function useHubChips(hubId: string): Chip[] {
  const isMaintenance = hubId === "maintenance";
  const isLogistics = hubId === "logistics";

  const woSummary = useQuery<WorkOrderSummary>({
    queryKey: ["/api/work-orders/summary"],
    staleTime: 60_000,
    enabled: isMaintenance,
  });
  const fleet = useQuery<FleetOverview>({
    queryKey: ["/api/equipment-intelligence/overview"],
    staleTime: 60_000,
    enabled: isMaintenance,
  });
  const lowStock = useQuery<LowStockResponse>({
    queryKey: ["/api/parts-inventory/low-stock-suggestions"],
    staleTime: 60_000,
    enabled: isLogistics,
  });

  const chips: Chip[] = [];
  if (isMaintenance) {
    const critical = fleet.data?.fleet?.criticalCount ?? 0;
    if (critical > 0) {
      chips.push({
        key: "critical-equipment",
        label: `${critical} critical`,
        href: "/equipment-intelligence",
        tone: "red",
      });
    }
    const open = woSummary.data?.openCount ?? woSummary.data?.open ?? 0;
    if (open > 0) {
      chips.push({
        key: "open-wos",
        label: `${open} open WOs`,
        href: "/work-orders?status=open",
        tone: "slate",
      });
    }
    const overdue = woSummary.data?.overdueCount ?? woSummary.data?.overdue ?? 0;
    if (overdue > 0) {
      // Overdue = still open with a due date in the past; dueDateTo is a
      // real URL filter, so the chip lands on exactly what it counted.
      const today = new Date().toISOString().split("T")[0];
      chips.push({
        key: "overdue-wos",
        label: `${overdue} overdue`,
        href: `/work-orders?status=open&dueDateTo=${today}`,
        tone: "amber",
      });
    }
  }
  if (isLogistics) {
    const stockouts = lowStock.data?.total ?? lowStock.data?.suggestions?.length ?? 0;
    if (stockouts > 0) {
      chips.push({
        key: "stockouts",
        label: `${stockouts} low stock`,
        href: "/logistics?tab=inventory&filter=low-stock",
        tone: "red",
      });
    }
  }
  return chips;
}

export function HubCountChips({ hubId }: { hubId: string }) {
  const [, setLocation] = useLocation();
  const chips = useHubChips(hubId);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLocation(chip.href);
          }}
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80 ${TONE_CLASSES[chip.tone]}`}
          data-testid={`chip-hub-${hubId}-${chip.key}`}
        >
          {chip.label}
          <span aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}
