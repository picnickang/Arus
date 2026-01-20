import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDeleteMutation } from "@/hooks/useCrudMutations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Equipment, Vessel } from "@shared/schema";
import { useState, useMemo, useEffect } from "react";
import { Server, ArchiveX, RefreshCw } from "lucide-react";
import { equipmentKeys, vesselKeys } from "@/utils/queryKeys";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useEquipmentFilters } from "@/hooks/useEquipmentFilters";
import { filterEquipment, calculateEquipmentStats } from "@/utils/equipmentHelpers";
import { EquipmentOverviewStats } from "@/components/equipment/EquipmentOverviewStats";
import { EquipmentFilters } from "@/components/equipment/EquipmentFilters";
import { EquipmentTable } from "@/components/equipment/EquipmentTable";
import { EquipmentCreateDialog, EquipmentEditDialog } from "@/components/equipment/EquipmentFormDialog";
import { EquipmentViewDialog } from "@/components/equipment/EquipmentViewDialog";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { DecommissionedEquipmentTable } from "@/components/equipment/DecommissionedEquipmentTable";
import { EquipmentDecommissionDialog } from "@/components/equipment/EquipmentDecommissionDialog";
import { EquipmentReinstateDialog } from "@/components/equipment/EquipmentReinstateDialog";
import { EquipmentHistoryDialog } from "@/components/equipment/EquipmentHistoryDialog";
import { LoadingState, TableSkeleton, CardSkeleton } from "@/components/patterns";
import { ErrorState } from "@/components/patterns";
import { normalizeQueryError } from "@/utils/errorHelpers";
import { PageHeader } from "@/components/navigation";
import { useMutation } from "@tanstack/react-query";

export default function EquipmentRegistry() {
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSensorWizardOpen, setIsSensorWizardOpen] = useState(false);
  const [isDecommissionDialogOpen, setIsDecommissionDialogOpen] = useState(false);
  const [isReinstateDialogOpen, setIsReinstateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "decommissioned">("active");

  // Filter state using custom hook
  const { filters, updateFilter, clearFilters, hasActiveFilters } = useEquipmentFilters();

  // Pagination state (client-side)
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Single query - fetch ALL equipment (unpaginated)
  const {
    data: allEquipment = [],
    isLoading,
    error: equipmentError,
    refetch: refetchEquipment,
  } = useVisibilityPolling<Equipment[]>({
    queryKey: equipmentKeys.list(),
    queryFn: () => apiRequest("GET", "/api/equipment"),
    interval: 30000,
    staleTime: 20000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch vessels for dropdowns
  const { data: vessels = [] } = useVisibilityPolling<Vessel[]>({
    queryKey: vesselKeys.lists(),
    queryFn: () => apiRequest("GET", "/api/vessels"),
    interval: 60000,
    staleTime: 45000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch decommissioned equipment
  const {
    data: decommissionedEquipment = [],
    isLoading: isLoadingDecommissioned,
    error: decommissionedError,
    refetch: refetchDecommissioned,
  } = useVisibilityPolling<Equipment[]>({
    queryKey: equipmentKeys.decommissioned(),
    queryFn: () => apiRequest("GET", "/api/equipment/decommissioned"),
    interval: 60000,
    staleTime: 45000,
    gcTime: 5 * 60 * 1000,
    enabled: activeTab === "decommissioned",
  });

  // Client-side filtering using helper
  const filteredEquipment = useMemo(() => {
    return filterEquipment(allEquipment, filters);
  }, [allEquipment, filters]);

  // Client-side pagination
  const paginatedEquipment = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredEquipment.slice(start, end);
  }, [filteredEquipment, page, pageSize]);

  // Pagination metadata
  const paginationMeta = useMemo(() => {
    const total = filteredEquipment.length;
    const totalPages = Math.ceil(total / pageSize);
    return {
      total,
      page,
      pageSize,
      totalPages,
    };
  }, [filteredEquipment.length, page, pageSize]);

  // Calculate stats from FULL dataset (not filtered)
  const stats = useMemo(() => {
    return calculateEquipmentStats(allEquipment, vessels, filteredEquipment.length);
  }, [allEquipment, vessels, filteredEquipment.length]);

  // Get unique manufacturers and types for filter dropdowns
  const uniqueManufacturers = useMemo(() => {
    const manufacturers = allEquipment.map((eq) => eq.manufacturer).filter((m): m is string => !!m);
    return Array.from(new Set(manufacturers)).sort((a, b) => a.localeCompare(b));
  }, [allEquipment]);

  const uniqueEquipmentTypes = useMemo(() => {
    const types = allEquipment.map((eq) => eq.type).filter((t): t is string => !!t);
    return Array.from(new Set(types)).sort((a, b) => a.localeCompare(b));
  }, [allEquipment]);

  // Equipment mutations
  const deleteEquipmentMutation = useDeleteMutation("/api/equipment", {
    successMessage: "Equipment deleted successfully",
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "An unexpected error occurred";
      toast({
        title: "Error deleting equipment",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  function handleEdit(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsEditDialogOpen(true);
  }

  function handleView(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsViewDialogOpen(true);
  }

  function handleDelete(equipment: Equipment) {
    const confirmMessage = `⚠️ WARNING: This will permanently delete equipment "${equipment.name}" and ALL associated data including:

• All sensor configurations
• All sensor states and readings
• Telemetry data
• Historical analytics

This action CANNOT be undone. Are you sure you want to proceed?`;

    if (confirm(confirmMessage)) {
      deleteEquipmentMutation.mutate(equipment.id);
    }
  }

  function handleSetupSensors(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsSensorWizardOpen(true);
  }

  function handleDecommission(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsDecommissionDialogOpen(true);
  }

  function handleReinstate(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsReinstateDialogOpen(true);
  }

  function handleViewHistory(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsHistoryDialogOpen(true);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleEquipmentUpdated() {
    refetchEquipment();
    refetchDecommissioned();
  }

  function handleLifecycleSuccess() {
    queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
    queryClient.invalidateQueries({ queryKey: equipmentKeys.decommissioned() });
    refetchEquipment();
    refetchDecommissioned();
  }

  const decommissionMutation = useMutation({
    mutationFn: async ({ equipmentId, data }: { equipmentId: string; data: unknown }) => {
      return apiRequest("POST", `/api/equipment/${equipmentId}/decommission`, data);
    },
    onSuccess: () => {
      toast({
        title: "Equipment Decommissioned",
        description: `${selectedEquipment?.name} has been successfully decommissioned.`,
      });
      setIsDecommissionDialogOpen(false);
      setSelectedEquipment(null);
      handleLifecycleSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to decommission equipment.",
        variant: "destructive",
      });
    },
  });

  function handleDecommissionSubmit(equipmentId: string, data: unknown) {
    decommissionMutation.mutate({ equipmentId, data });
  }

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Clamp page when dataset shrinks (e.g., after deletion or filtering)
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [filteredEquipment.length, pageSize, page]);

  // Check for initial loading state
  const isInitialLoading = isLoading && allEquipment.length === 0;

  return (
    <div className="min-h-screen">
      <PageHeader title="Equipment Registry" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Equipment
                </CardTitle>
                <CardDescription className="mt-2">
                  Centralized equipment inventory and sensor configuration management
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        <CardContent className="space-y-6">
          {/* Initial Loading State */}
          {isInitialLoading ? (
            <LoadingState variant="custom">
              <div className="space-y-6">
                {/* Stats Skeleton */}
                <div className="grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <CardSkeleton key={`stat-${i}`} />
                  ))}
                </div>

                {/* Filters Skeleton */}
                <CardSkeleton />

                {/* Table Skeleton */}
                <TableSkeleton rows={5} cols={6} />
              </div>
            </LoadingState>
          ) : equipmentError ? (
            /* Error State */
            <ErrorState
              error={normalizeQueryError(equipmentError)}
              onRetry={refetchEquipment}
              variant="inline"
            />
          ) : (
            /* Actual Content */
            <>
              {/* Stats Overview */}
              <EquipmentOverviewStats stats={stats} />

              {/* Tabs for Active/Decommissioned */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "decommissioned")}>
                <TabsList className="mb-4">
                  <TabsTrigger value="active" className="flex items-center gap-2" data-testid="tab-active-equipment">
                    <Server className="h-4 w-4" />
                    Active Equipment
                    <Badge variant="secondary" className="ml-1">{allEquipment.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="decommissioned" className="flex items-center gap-2" data-testid="tab-decommissioned-equipment">
                    <ArchiveX className="h-4 w-4" />
                    Decommissioned
                    <Badge variant="secondary" className="ml-1">{decommissionedEquipment.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4 space-y-4">
                  {/* Filters */}
                  <EquipmentFilters
                    filters={filters}
                    onFiltersChange={updateFilter}
                    onClearFilters={clearFilters}
                    hasActiveFilters={hasActiveFilters}
                    vessels={vessels}
                    equipmentTypes={uniqueEquipmentTypes}
                    manufacturers={uniqueManufacturers}
                    filteredCount={filteredEquipment.length}
                    totalCount={allEquipment.length}
                    onAddEquipment={() => setIsCreateDialogOpen(true)}
                  />

                  {/* Equipment Table */}
                  <EquipmentTable
                    equipment={paginatedEquipment}
                    vessels={vessels}
                    paginationMeta={paginationMeta}
                    onPageChange={handlePageChange}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSetupSensors={handleSetupSensors}
                    onDecommission={handleDecommission}
                    onViewHistory={handleViewHistory}
                  />
                </TabsContent>

                <TabsContent value="decommissioned" className="mt-4 space-y-4">
                  {isLoadingDecommissioned ? (
                    <TableSkeleton rows={5} cols={5} />
                  ) : decommissionedError ? (
                    <ErrorState
                      error={normalizeQueryError(decommissionedError)}
                      onRetry={refetchDecommissioned}
                      variant="inline"
                    />
                  ) : decommissionedEquipment.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <ArchiveX className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">No Decommissioned Equipment</p>
                      <p className="text-sm">Equipment that is decommissioned will appear here.</p>
                    </div>
                  ) : (
                    <DecommissionedEquipmentTable
                      equipment={decommissionedEquipment}
                      vessels={vessels}
                      onReinstate={handleReinstate}
                      onViewHistory={handleViewHistory}
                      onDelete={handleDelete}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <EquipmentCreateDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        vessels={vessels}
        onSuccess={handleEquipmentUpdated}
      />

      {/* Edit Dialog */}
      <EquipmentEditDialog
        isOpen={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
        vessels={vessels}
        onSuccess={handleEquipmentUpdated}
      />

      {/* View Dialog */}
      <EquipmentViewDialog
        isOpen={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
        onEquipmentUpdated={handleEquipmentUpdated}
      />

      {/* Sensor Setup Wizard */}
      {selectedEquipment && (
        <SensorSetupWizard
          equipment={{
            id: selectedEquipment.id,
            name: selectedEquipment.name,
            type: selectedEquipment.type,
            status: selectedEquipment.isActive ? "active" : "inactive",
            location: selectedEquipment.location || "Unknown",
          }}
          open={isSensorWizardOpen}
          onClose={() => {
            setIsSensorWizardOpen(false);
            setSelectedEquipment(null);
          }}
          onSuccess={handleEquipmentUpdated}
        />
      )}

      {/* Decommission Dialog */}
      <EquipmentDecommissionDialog
        open={isDecommissionDialogOpen}
        onOpenChange={(open) => {
          setIsDecommissionDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
        onSubmit={handleDecommissionSubmit}
        isPending={decommissionMutation.isPending}
      />

      {/* Reinstate Dialog */}
      <EquipmentReinstateDialog
        isOpen={isReinstateDialogOpen}
        onOpenChange={(open) => {
          setIsReinstateDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
        onSuccess={handleLifecycleSuccess}
      />

      {/* History Dialog */}
      <EquipmentHistoryDialog
        isOpen={isHistoryDialogOpen}
        onOpenChange={(open) => {
          setIsHistoryDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
      />
      </div>
    </div>
  );
}
