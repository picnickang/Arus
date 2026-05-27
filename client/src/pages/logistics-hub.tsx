/**
 * UI Align Phase 6 — Logistics Overview (panel 4 / row 10 logistics
 * columns).
 *
 * Headline counters (low-stock blockers, estimated reorder cost) +
 * low-stock parts list bound to the same endpoint Inventory
 * Management uses. Deep-link routes (/inventory-management,
 * /service-orders, /vendors) continue to work — this hub only adds
 * the overview layer.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Wrench,
  Building2,
  AlertTriangle,
  PackageX,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface LowStockSuggestion {
  partId?: string | null;
  partNumber?: string | null;
  partName?: string | null;
  quantityOnHand?: number | null;
  minStockLevel?: number | null;
  suggestedOrderQty?: number | null;
  estimatedCost?: number | null;
  vesselName?: string | null;
}

interface LowStockResponse {
  total?: number;
  suggestions?: LowStockSuggestion[];
  estimatedTotalCost?: number | null;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "$—";
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

export default function LogisticsHub() {
  const {
    data: lowStock,
    isLoading,
    error,
  } = useQuery<LowStockResponse>({
    queryKey: ["/api/parts-inventory/low-stock-suggestions"],
    staleTime: 60_000,
  });

  const suggestions = lowStock?.suggestions ?? [];
  const blockerCount = lowStock?.total ?? suggestions.length;
  const estimatedCost = lowStock?.estimatedTotalCost ?? null;

  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="logistics-hub-overview">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Logistics Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inventory blockers, purchasing, service orders, and supplier management.
          </p>
        </div>
        <Link href="/logistics?tab=inventory">
          <Button data-testid="button-open-inventory" variant="outline" className="gap-2">
            Open inventory <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm"
          data-testid="logistics-hub-error"
        >
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <span>Could not load inventory data. Try again shortly.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="logistics-counter-row">
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <Card data-testid="counter-blockers">
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className={`rounded-md p-2 ${
                    blockerCount > 0
                      ? "bg-rose-500/15 text-rose-600"
                      : "bg-emerald-500/15 text-emerald-600"
                  }`}
                >
                  <PackageX className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Inventory Blockers
                  </div>
                  <div className="text-3xl font-bold mt-1">{blockerCount}</div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="counter-reorder-cost">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-md p-2 bg-blue-500/15 text-blue-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Estimated Reorder Cost
                  </div>
                  <div className="text-3xl font-bold mt-1">{formatCurrency(estimatedCost)}</div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h2 className="text-sm font-semibold">Low-stock parts</h2>
            <Link href="/logistics?tab=inventory&filter=low-stock">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                data-testid="button-view-all-low-stock"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div
              className="p-6 text-sm text-muted-foreground"
              data-testid="empty-low-stock"
            >
              All parts are above minimum stock levels.
            </div>
          ) : (
            <ul className="divide-y" data-testid="list-low-stock">
              {suggestions.slice(0, 10).map((p, i) => (
                <li
                  key={p.partId ?? `${p.partNumber ?? "row"}-${i}`}
                  className="flex items-center gap-3 px-4 py-2"
                  data-testid={`row-low-stock-${p.partId ?? i}`}
                >
                  <div className="text-xs font-mono text-muted-foreground w-24 shrink-0 truncate">
                    {p.partNumber ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.partName ?? "Unnamed part"}
                    </div>
                    {p.vesselName && (
                      <div className="text-xs text-muted-foreground truncate">{p.vesselName}</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground w-24 text-right shrink-0">
                    {p.quantityOnHand ?? 0} / {p.minStockLevel ?? 0}
                  </div>
                  <div className="text-xs font-semibold w-20 text-right shrink-0">
                    {formatCurrency(p.estimatedCost)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Jump to</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="logistics-jump-grid">
          <JumpCard
            href="/logistics?tab=inventory"
            icon={Boxes}
            label="Inventory"
            description="Stock levels & purchasing"
            testId="jump-inventory"
          />
          <JumpCard
            href="/service-orders"
            icon={Wrench}
            label="Service Orders"
            description="External services"
            testId="jump-service-orders"
          />
          <JumpCard
            href="/vendors"
            icon={Building2}
            label="Vendors & Providers"
            description="Suppliers & service providers"
            testId="jump-vendors"
          />
        </div>
      </div>
    </div>
  );
}

function JumpCard({
  href,
  icon: Icon,
  label,
  description,
  testId,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  description?: string;
  testId: string;
}) {
  return (
    <Link href={href}>
      <Card
        className="hover:bg-accent/40 transition-colors cursor-pointer"
        data-testid={testId}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="h-5 w-5 text-primary shrink-0" />
          <div>
            <div className="text-sm font-medium">{label}</div>
            {description && (
              <div className="text-xs text-muted-foreground">{description}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
