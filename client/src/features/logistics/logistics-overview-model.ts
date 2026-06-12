import { formatCurrency as formatCurrencyCanonical } from "@/lib/formatters";
import type { ServiceRequest } from "@/features/serviceRequests/types";
import type { ServiceOrder } from "@/features/serviceOrders/types";
import type { SupplierWithStats } from "@/features/suppliers/types";

export type LogisticsTab =
  | "overview"
  | "inventory"
  | "vendors"
  | "service-orders"
  | "service-requests";

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

export interface LogisticsKpi {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "green" | "amber" | "red" | "purple";
}

export interface LogisticsQueueItem {
  id: string;
  title: string;
  context: string;
  status: string;
  tone: "blue" | "green" | "amber" | "red" | "purple";
  href: string;
  action: string;
}

interface LogisticsDataSourceStatus {
  id: string;
  label: string;
  state: "healthy" | "empty" | "degraded";
  detail: string;
}

export interface LogisticsSafeError {
  title: string;
  message: string;
  tone: "auth" | "permission" | "retry";
}

export interface LogisticsOverviewInput {
  lowStock?: LowStockResponse | undefined;
  serviceRequests?: ServiceRequest[] | undefined;
  serviceOrders?: ServiceOrder[] | undefined;
  vendors?: SupplierWithStats[] | undefined;
  errors?: {
    lowStock?: unknown;
    serviceRequests?: unknown;
    serviceOrders?: unknown;
    vendors?: unknown;
  };
}

export interface LogisticsOverviewModel {
  kpis: LogisticsKpi[];
  urgentQueue: LogisticsQueueItem[];
  lowStockRows: LowStockSuggestion[];
  serviceRequestRows: LogisticsQueueItem[];
  serviceOrderRows: LogisticsQueueItem[];
  vendorRows: LogisticsQueueItem[];
  dataHealth: LogisticsDataSourceStatus[];
  errors: LogisticsSafeError[];
  emptyMessage: string | null;
}

export function parseLogisticsTab(search: string): LogisticsTab {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const raw = new URLSearchParams(normalized).get("tab");
  switch (raw) {
    case "inventory":
    case "vendors":
    case "service-orders":
    case "service-requests":
      return raw;
    default:
      return "overview";
  }
}

/** Compact "$1.2k" rendering for KPI helpers; NaN/null render "N/A". */
function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }
  return formatCurrencyCanonical(value, { display: "compact-k" });
}

export function formatLogisticsError(error: unknown): LogisticsSafeError {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  if (message.includes("401") || message.includes("authorization") || message.includes("session")) {
    return {
      title: "Session required",
      message: "Your session expired. Sign in again.",
      tone: "auth",
    };
  }
  if (message.includes("403") || message.includes("forbidden") || message.includes("permission")) {
    return {
      title: "Permission required",
      message: "You do not have permission to view this data.",
      tone: "permission",
    };
  }
  return {
    title: "Data unavailable",
    message: "This data could not be loaded. Retry.",
    tone: "retry",
  };
}

function countOrNA<T>(items: T[] | undefined, filter?: (item: T) => boolean): string {
  if (!items) {
    return "N/A";
  }
  return String(filter ? items.filter(filter).length : items.length);
}

function sourceState(
  hasError: boolean,
  items: unknown[] | undefined,
  loadedObject: unknown,
  healthyDetail: string,
  emptyDetail: string
): Pick<LogisticsDataSourceStatus, "state" | "detail"> {
  if (hasError) {
    return { state: "degraded", detail: "Retryable data issue" };
  }
  if (Array.isArray(items)) {
    return items.length > 0
      ? { state: "healthy", detail: healthyDetail }
      : { state: "empty", detail: emptyDetail };
  }
  if (loadedObject !== undefined) {
    return { state: "healthy", detail: healthyDetail };
  }
  return { state: "degraded", detail: "No recent data" };
}

function isOpenServiceOrder(order: ServiceOrder): boolean {
  return order.status !== "completed" && order.status !== "cancelled";
}

function isPendingServiceRequest(request: ServiceRequest): boolean {
  return request.status === "pending_review" || request.status === "under_review";
}

function hasVendorIssue(vendor: SupplierWithStats): boolean {
  return (
    vendor.isActive === false ||
    (typeof vendor.qualityRating === "number" && vendor.qualityRating < 3)
  );
}

function partName(part: LowStockSuggestion): string {
  return part.partName || part.partNumber || "Unnamed part";
}

function requestContext(request: ServiceRequest): string {
  const vessel = request.vesselName || "Unassigned vessel";
  const equipment = request.equipmentName || request.workOrderNumber || request.requestNumber;
  return `${vessel} • ${equipment}`;
}

function orderTitle(order: ServiceOrder): string {
  return order.scope || order.serviceDetails || order.workOrderDescription || order.soNumber;
}

function orderContext(order: ServiceOrder): string {
  const vessel = order.vesselName || "Unassigned vessel";
  const vendor = order.serviceProviderName || "Vendor pending";
  return `${vessel} • ${vendor}`;
}

export function buildLogisticsOverviewModel(input: LogisticsOverviewInput): LogisticsOverviewModel {
  const lowStockRows = input.lowStock?.suggestions ?? [];
  const pendingRequests = input.serviceRequests?.filter(isPendingServiceRequest);
  const openOrders = input.serviceOrders?.filter(isOpenServiceOrder);
  const vendorIssues = input.vendors?.filter(hasVendorIssue);
  const errors = Object.values(input.errors ?? {})
    .filter(Boolean)
    .map(formatLogisticsError);

  const stockoutCount =
    input.lowStock === undefined ? "N/A" : String(input.lowStock.total ?? lowStockRows.length);

  const kpis: LogisticsKpi[] = [
    {
      id: "critical-stockouts",
      label: "Critical Stockouts",
      value: stockoutCount,
      helper:
        input.lowStock === undefined
          ? "Inventory source unavailable"
          : `${formatCurrency(input.lowStock.estimatedTotalCost)} reorder estimate`,
      tone: stockoutCount === "0" ? "green" : "red",
    },
    {
      id: "pending-requests",
      label: "Pending Requests",
      value: countOrNA(input.serviceRequests, isPendingServiceRequest),
      helper: "Awaiting review",
      tone: "amber",
    },
    {
      id: "open-service-orders",
      label: "Open Service Orders",
      value: countOrNA(input.serviceOrders, isOpenServiceOrder),
      helper: "Vendor work in motion",
      tone: "blue",
    },
    {
      id: "vendor-issues",
      label: "Vendor Issues",
      value: countOrNA(input.vendors, hasVendorIssue),
      helper: "Certification or quality follow-up",
      tone: "purple",
    },
  ];

  const stockQueue: LogisticsQueueItem[] = lowStockRows.slice(0, 3).map((part, index) => ({
    id: `stock-${part.partId ?? part.partNumber ?? index}`,
    title: partName(part),
    context: `${part.vesselName || "Fleet stores"} • ${part.quantityOnHand ?? 0}/${part.minStockLevel ?? 0} on hand`,
    status: Number(part.quantityOnHand ?? 0) <= 0 ? "Critical" : "Low",
    tone: Number(part.quantityOnHand ?? 0) <= 0 ? "red" : "amber",
    href: `/logistics?tab=inventory&filter=low-stock${part.partId ? `&partId=${part.partId}` : ""}`,
    action: "Open inventory",
  }));

  const serviceRequestRows: LogisticsQueueItem[] = (pendingRequests ?? [])
    .slice(0, 3)
    .map((request) => ({
      id: `request-${request.id}`,
      title: request.title,
      context: requestContext(request),
      status:
        request.urgency === "critical"
          ? "Critical"
          : request.urgency === "high"
            ? "High"
            : "Review",
      tone: request.urgency === "critical" ? "red" : request.urgency === "high" ? "amber" : "blue",
      href: `/logistics?tab=service-requests&focus=${request.id}`,
      action: request.status === "approved" ? "Convert" : "Review",
    }));

  const serviceOrderRows: LogisticsQueueItem[] = (openOrders ?? []).slice(0, 3).map((order) => ({
    id: `order-${order.id}`,
    title: orderTitle(order),
    context: orderContext(order),
    status: order.urgency === "critical" ? "Critical" : order.status.replace(/_/g, " "),
    tone: order.urgency === "critical" ? "red" : order.urgency === "urgent" ? "amber" : "blue",
    href: `/logistics?tab=service-orders&focus=${order.id}`,
    action: "Open order",
  }));

  const vendorRows: LogisticsQueueItem[] = (vendorIssues ?? []).slice(0, 3).map((vendor) => ({
    id: `vendor-${vendor.id}`,
    title: vendor.name,
    context: vendor.type === "service_provider" ? "Service provider" : "Supplier",
    status: vendor.isActive ? "Quality" : "Inactive",
    tone: vendor.isActive ? "amber" : "red",
    href: `/logistics?tab=vendors&focus=${vendor.id}`,
    action: "Open vendor",
  }));

  const urgentQueue = [
    ...stockQueue,
    ...serviceRequestRows,
    ...serviceOrderRows,
    ...vendorRows,
  ].slice(0, 6);

  const inventoryState = sourceState(
    Boolean(input.errors?.lowStock),
    lowStockRows,
    input.lowStock,
    "Inventory ledger connected",
    "No critical stockouts"
  );
  const requestsState = sourceState(
    Boolean(input.errors?.serviceRequests),
    input.serviceRequests,
    input.serviceRequests,
    "Service requests connected",
    "No requests awaiting review"
  );
  const ordersState = sourceState(
    Boolean(input.errors?.serviceOrders),
    input.serviceOrders,
    input.serviceOrders,
    "Service orders connected",
    "No service orders open"
  );
  const vendorsState = sourceState(
    Boolean(input.errors?.vendors),
    input.vendors,
    input.vendors,
    "Vendor registry connected",
    "No vendor follow-up"
  );

  return {
    kpis,
    urgentQueue,
    lowStockRows,
    serviceRequestRows,
    serviceOrderRows,
    vendorRows,
    errors,
    emptyMessage:
      urgentQueue.length === 0
        ? "No urgent logistics actions are available from the current data."
        : null,
    dataHealth: [
      { id: "inventory", label: "Inventory ledger", ...inventoryState },
      { id: "service-requests", label: "Service requests", ...requestsState },
      { id: "service-orders", label: "Service orders", ...ordersState },
      { id: "vendors", label: "Vendor registry", ...vendorsState },
    ],
  };
}
