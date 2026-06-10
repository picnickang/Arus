/**
 * UI Align Phase 6 — Logistics Hub.
 *
 * `/logistics` is the canonical mount for the entire logistics surface.
 * The legacy routes /inventory-management, /vendors, /suppliers,
 * /service-providers redirect here (see `legacyRedirects` in
 * navigationConfig). We dispatch on `?tab=` to render the right child
 * page:
 *
 *   /logistics                       → LogisticsOverview (default)
 *   /logistics?tab=inventory         → InventoryManagement
 *   /logistics?tab=vendors           → VendorsPage
 *   /logistics?tab=service-orders    → ServiceOrdersPage
 *   /logistics?tab=service-requests  → ServiceRequestsPage
 *
 * Without this dispatcher every "Open inventory" / "View all" / jump
 * card / BottomNav item that targets `/logistics?tab=…` lands back
 * on the overview, which looks like a dead button.
 */
import { lazy, Suspense } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Wrench,
  Building2,
  AlertTriangle,
  PackageX,
  ChevronRight,
  ClipboardList,
  PackageCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoader } from "@/components/layouts/PageLoader";
import { useServiceRequests } from "@/features/serviceRequests/hooks/useServiceRequests";
import { useServiceOrders } from "@/features/serviceOrders/hooks/useServiceOrders";
import { useSuppliersWithStats } from "@/features/suppliers/hooks/useSuppliers";
import {
  buildLogisticsOverviewModel,
  formatCurrency,
  parseLogisticsTab,
  type LowStockResponse,
} from "@/features/logistics/logistics-overview-model";
import {
  ActionButton,
  DataHealthStrip,
  EmptyState,
  JumpCard,
  KpiCard,
  PanelHeader,
  QueueRow,
  SkeletonList,
} from "@/features/logistics/LogisticsOverviewPanels";

const InventoryManagement = lazy(() => import("@/pages/inventory-management"));
const VendorsPage = lazy(() =>
  import("@/features/suppliers").then((m) => ({ default: m.VendorsPage }))
);
const ServiceOrdersPage = lazy(() =>
  import("@/features/serviceOrders").then((m) => ({ default: m.ServiceOrdersPage }))
);
const ServiceRequestsPage = lazy(() =>
  import("@/features/serviceRequests").then((m) => ({ default: m.ServiceRequestsPage }))
);

export default function LogisticsHub() {
  const searchString = useSearch();
  const tab = parseLogisticsTab(searchString);

  if (tab !== "overview") {
    return (
      <Suspense fallback={<PageLoader variant="cards" />}>
        {tab === "inventory" && <InventoryManagement />}
        {tab === "vendors" && <VendorsPage />}
        {tab === "service-orders" && <ServiceOrdersPage />}
        {tab === "service-requests" && <ServiceRequestsPage />}
      </Suspense>
    );
  }

  return <LogisticsOverview />;
}

function LogisticsOverview() {
  const lowStockQuery = useQuery<LowStockResponse>({
    queryKey: ["/api/parts-inventory/low-stock-suggestions"],
    staleTime: 60_000,
  });
  const serviceRequestsQuery = useServiceRequests({ status: "actionable", sortBy: "urgency" });
  const serviceOrdersQuery = useServiceOrders();
  const vendorsQuery = useSuppliersWithStats();

  const isLoading =
    lowStockQuery.isLoading ||
    serviceRequestsQuery.isLoading ||
    serviceOrdersQuery.isLoading ||
    vendorsQuery.isLoading;
  const model = buildLogisticsOverviewModel({
    lowStock: lowStockQuery.data,
    serviceRequests: serviceRequestsQuery.data,
    serviceOrders: serviceOrdersQuery.data,
    vendors: vendorsQuery.data,
    errors: {
      lowStock: lowStockQuery.error,
      serviceRequests: serviceRequestsQuery.error,
      serviceOrders: serviceOrdersQuery.error,
      vendors: vendorsQuery.error,
    },
  });

  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="logistics-hub-overview">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Logistics Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inventory blockers, service requests, service orders, and vendor actions.
          </p>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="logistics-data-freshness">
            Updated from live sources when available. Missing sources stay visible as degraded.
          </p>
        </div>
        <Button asChild data-testid="button-open-inventory" variant="outline" className="gap-2">
          <Link href="/logistics?tab=inventory">
            Open inventory <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        data-testid="logistics-action-row"
      >
        <ActionButton
          href="/logistics?tab=inventory&action=receive"
          label="Receive Stock"
          icon={PackageCheck}
          primary
        />
        <ActionButton
          href="/logistics?tab=inventory&action=reserve"
          label="Reserve Parts"
          icon={Boxes}
        />
        <ActionButton
          href="/logistics?tab=inventory&action=consume"
          label="Consume Parts"
          icon={PackageX}
        />
        <ActionButton
          href="/logistics?tab=service-requests&action=create"
          label="Create Request"
          icon={ClipboardList}
        />
        <ActionButton
          href="/logistics?tab=service-orders&action=create"
          label="Create Order"
          icon={Wrench}
        />
        <ActionButton
          href="/logistics?tab=vendors&action=create"
          label="Add Vendor"
          icon={Building2}
        />
      </div>

      {model.errors.length > 0 && (
        <div className="grid gap-2" data-testid="logistics-error-state">
          {model.errors.map((safeError, index) => (
            <div
              key={`${safeError.title}-${index}`}
              className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm"
              data-testid="logistics-hub-error"
            >
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">{safeError.title}</div>
                <div className="text-muted-foreground">{safeError.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
        data-testid="logistics-counter-row"
      >
        {isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            {model.kpis[0] && <KpiCard kpi={model.kpis[0]} data-testid="counter-blockers" />}
            {model.kpis[1] && <KpiCard kpi={model.kpis[1]} data-testid="counter-reorder-cost" />}
            {model.kpis.slice(2).map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} data-testid={`counter-${kpi.id}`} />
            ))}
          </>
        )}
      </div>

      <Card data-testid="logistics-urgent-queue">
        <CardContent className="p-0">
          <PanelHeader
            title="Urgent Logistics Queue"
            description="Stock, requests, orders and vendors — one exception-first feed"
          />
          {isLoading ? (
            <SkeletonList rows={4} />
          ) : model.urgentQueue.length === 0 ? (
            <EmptyState message={model.emptyMessage ?? "No urgent logistics actions."} />
          ) : (
            <div className="divide-y">
              {model.urgentQueue.map((row) => (
                <QueueRow key={row.id} row={row} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <PanelHeader
            title="Low-stock parts"
            description="Inventory ledger blockers and reorder estimate"
            actionHref="/logistics?tab=inventory&filter=low-stock"
            actionLabel="View all"
            actionTestId="button-view-all-low-stock"
          />
          {isLoading ? (
            <SkeletonList rows={4} />
          ) : model.lowStockRows.length === 0 ? (
            <EmptyState
              message="No critical stockouts. View all inventory when you need the full catalog."
              testId="empty-low-stock"
            />
          ) : (
            <ul className="divide-y" data-testid="list-low-stock">
              {model.lowStockRows.slice(0, 6).map((p, i) => (
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

      <DataHealthStrip sources={model.dataHealth} />

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Jump to</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="logistics-jump-grid">
          <JumpCard
            href="/logistics?tab=inventory"
            icon={Boxes}
            label="Inventory"
            description="Stock levels & purchasing"
            testId="jump-inventory"
          />
          <JumpCard
            href="/logistics?tab=service-requests"
            icon={ClipboardList}
            label="Service Requests"
            description="Pending requests"
            testId="jump-service-requests"
          />
          <JumpCard
            href="/logistics?tab=service-orders"
            icon={Wrench}
            label="Service Orders"
            description="External services"
            testId="jump-service-orders"
          />
          <JumpCard
            href="/logistics?tab=vendors"
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
