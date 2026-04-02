/**
 * ServiceOrdersPage — UX Improvements
 *
 * UX FIX #3: Cards/Calendar toggle view
 * UX FIX #6: Supplier performance scores in provider filter dropdown
 *
 * Changes from original:
 * - Added "Cards | Calendar" view toggle in the header
 * - Calendar view renders ServiceOrderCalendar component
 * - Provider filter shows performance badge inline
 *
 * Drop-in replacement for:
 *   client/src/features/serviceOrders/pages/ServiceOrdersPage.tsx
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Building2, Calendar, Wrench, CheckCircle, Plus, FileText, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SOCard } from "../components/SOCard";
import { ServiceOrderFormDialog } from "../components/ServiceOrderFormDialog";
import { ServiceOrderCalendar } from "../components/ServiceOrderCalendar";
import { SupplierPerformanceSelect } from "@/features/suppliers/components/SupplierPerformanceSelect";
import { useServiceOrders, useSendServiceOrder, useConfirmServiceOrder, useStartServiceOrder, useCompleteServiceOrder, useCancelServiceOrder } from "../hooks/useServiceOrders";
import type { ServiceOrder } from "../types";

type ViewMode = "cards" | "calendar";

export default function ServiceOrdersPage() {
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("arus:serviceOrders:viewMode");
    return saved === "calendar" ? "calendar" : "cards";
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("arus:serviceOrders:viewMode", mode);
  };
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);

  const { data: orders, isLoading, refetch } = useServiceOrders(statusFilter !== "all" ? { status: statusFilter } : {});
  const { data: suppliers } = useQuery<{ id: string; name: string; qualityRating?: number; responseSlaHours?: number }[]>({ queryKey: ["/api/suppliers"] });

  const sendMutation = useSendServiceOrder();
  const confirmMutation = useConfirmServiceOrder();
  const startMutation = useStartServiceOrder();
  const completeMutation = useCompleteServiceOrder();
  const cancelMutation = useCancelServiceOrder();

  const isActionPending = sendMutation.isPending || confirmMutation.isPending || startMutation.isPending || completeMutation.isPending || cancelMutation.isPending;

  const filteredOrders = (orders ?? []).filter((order) => {
    if (providerFilter !== "all" && order.serviceProviderId !== providerFilter) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return order.soNumber.toLowerCase().includes(term) || order.serviceProviderName?.toLowerCase().includes(term) || order.workOrderNumber?.toLowerCase().includes(term) || order.scope?.toLowerCase().includes(term) || order.status?.toLowerCase().includes(term);
  });

  const stats = {
    total: orders?.length || 0,
    draft: orders?.filter((o) => o.status === "draft").length || 0,
    confirmed: orders?.filter((o) => o.status === "confirmed").length || 0,
    inProgress: orders?.filter((o) => o.status === "in_progress").length || 0,
    completed: orders?.filter((o) => o.status === "completed").length || 0,
  };

  const handleEdit = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setEditDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    refetch();
    setSelectedOrder(null);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center"><div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-96" /></div><Skeleton className="h-10 w-48" /></div>
        <div className="grid grid-cols-5 gap-6">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-6 pt-4">
        {/* UX FIX #3: View toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted">
          <Button
            variant={viewMode === "cards" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewModeChange("cards")}
            className="h-8 px-3"
            data-testid="toggle-view-cards"
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Cards
          </Button>
          <Button
            variant={viewMode === "calendar" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewModeChange("calendar")}
            className="h-8 px-3"
            data-testid="toggle-view-calendar"
          >
            <Calendar className="h-4 w-4 mr-1" />
            Calendar
          </Button>
        </div>

        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-so">
          <Plus className="h-4 w-4 mr-2" /> New Service Order
        </Button>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <StatCard icon={<Wrench className="h-5 w-5" />} label="Total Orders" value={stats.total} testId="stat-total-so" />
          <StatCard icon={<FileText className="h-5 w-5" />} label="Draft" value={stats.draft} testId="stat-draft-so" className="text-gray-600" />
          <StatCard icon={<Building2 className="h-5 w-5" />} label="Confirmed" value={stats.confirmed} testId="stat-confirmed-so" className="text-blue-600" />
          <StatCard icon={<Calendar className="h-5 w-5" />} label="In Progress" value={stats.inProgress} testId="stat-in-progress-so" className="text-yellow-600" />
          <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Completed" value={stats.completed} testId="stat-completed-so" className="text-green-600" />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <CardTitle>Service Orders</CardTitle>
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search orders..." className="pl-9 w-64" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-so" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                {/* UX FIX #6: Supplier performance in dropdown */}
                <SupplierPerformanceSelect
                  value={providerFilter}
                  onValueChange={setProviderFilter}
                  filterType="service_provider"
                  includeAll
                  allLabel="All Providers"
                  placeholder="Provider"
                  className="w-48"
                  data-testid="select-provider-filter"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* UX FIX #3: Conditional rendering based on view mode */}
            {viewMode === "calendar" ? (
              <ServiceOrderCalendar
                serviceOrders={filteredOrders.map((o) => ({
                  id: o.id,
                  soNumber: o.soNumber,
                  status: o.status,
                  scheduledStartDate: o.scheduledStartDate,
                  scheduledEndDate: o.scheduledEndDate,
                  serviceProviderName: o.serviceProviderName,
                  vesselName: o.vesselName,
                  equipmentName: o.equipmentName,
                  estimatedDurationHours: o.estimatedDurationHours,
                }))}
                onSelect={(so) => {
                  const order = filteredOrders.find((o) => o.id === so.id);
                  if (order) handleEdit(order);
                }}
              />
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-orders">
                <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No service orders found</p>
                <p className="text-sm mt-2">Create a new service order or adjust your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => (
                  <SOCard
                    key={order.id}
                    order={order}
                    onEdit={handleEdit}
                    onSend={(id) => sendMutation.mutate(id)}
                    onConfirm={(id) => confirmMutation.mutate(id)}
                    onStart={(id) => startMutation.mutate(id)}
                    onComplete={(id) => completeMutation.mutate({ id })}
                    onCancel={(id) => cancelMutation.mutate({ id })}
                    isLoading={isActionPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ServiceOrderFormDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} mode="create" onSuccess={handleDialogSuccess} />
      <ServiceOrderFormDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} mode="edit" serviceOrder={selectedOrder} onSuccess={handleDialogSuccess} />
    </div>
  );
}

function StatCard({ icon, label, value, testId, className = "" }: { icon: React.ReactNode; label: string; value: number; testId: string; className?: string }) {
  return (
    <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">{label}</p><p className={`text-2xl font-bold mt-1 ${className}`} data-testid={testId}>{value}</p></div><div className={`p-3 rounded-full bg-muted ${className}`}>{icon}</div></div></CardContent></Card>
  );
}
