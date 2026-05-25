import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useDeleteMutation } from "@/hooks/useCrudMutations";
import { Equipment, Vessel } from "@shared/schema";

interface EquipmentHealth {
  equipmentId: string;
  healthScore: number;
  status: string;
  [key: string]: unknown;
}
import { equipmentKeys, vesselKeys } from "@/utils/queryKeys";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useEquipmentHealth } from "@/features/vessels";

interface EquipmentWithHealth extends Equipment {
  health?: EquipmentHealth;
}

export function useEquipmentPageData() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithHealth | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isSensorWizardOpen, setIsSensorWizardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [vesselFilter, setVesselFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const {
    data: allEquipment = [],
    isLoading: equipmentLoading,
    refetch: refetchEquipment,
  } = useVisibilityPolling<Equipment[]>({
    queryKey: equipmentKeys.list(),
    queryFn: () => apiRequest("GET", "/api/equipment"),
    interval: 30000,
    staleTime: 20000,
    gcTime: 5 * 60 * 1000,
  });
  const { data: vessels = [] } = useVisibilityPolling<Vessel[]>({
    queryKey: vesselKeys.lists(),
    queryFn: () => apiRequest("GET", "/api/vessels"),
    interval: 60000,
    staleTime: 45000,
    gcTime: 5 * 60 * 1000,
  });
  const { data: healthResponse = [], isLoading: _healthLoading } = useEquipmentHealth();

  interface RawHealthItem {
    id: string;
    vesselId?: string;
    vessel?: string;
    name: string;
    type: string;
    healthIndex?: number;
    healthScore?: number;
    predictedDueDays?: number;
    status?: "healthy" | "warning" | "critical";
    condition?: string;
  }
  const healthData: EquipmentHealth[] = useMemo(() => {
    if (!healthResponse || !Array.isArray(healthResponse)) {
      return [];
    }
    return (healthResponse as RawHealthItem[]).map((item) => (({
      id: item.id,
      vessel: item.vesselId || item.vessel || "",
      vesselId: item.vesselId || item.vessel || undefined,
      name: item.name,
      type: item.type,
      healthIndex: item.healthIndex ?? item.healthScore ?? 0,
      predictedDueDays: item.predictedDueDays ?? 30,
      status:
        item.status ||
        (item.condition === "critical" || item.condition === "poor"
          ? ("critical" as const)
          : item.condition === "fair"
            ? ("warning" as const)
            : ("healthy" as const)),
    }) as never));
  }, [healthResponse]);
  const healthMap = useMemo(() => {
    const map = new Map<string, EquipmentHealth>();
    healthData.forEach((h) => {
      if (h['id']) {
        map.set(h['id'] as string, h);
      }
    });
    return map;
  }, [healthData]);
  const equipmentWithHealth: EquipmentWithHealth[] = useMemo(
    () => allEquipment.map((eq) => ({ ...eq, health: healthMap.get(eq.id) })) as object as EquipmentWithHealth[],
    [allEquipment, healthMap]
  );
  const uniqueTypes = useMemo(() => {
    const types = allEquipment.map((eq) => eq.type).filter((t): t is string => !!t);
    return Array.from(new Set(types)).sort((a, b) => a.localeCompare(b));
  }, [allEquipment]);

  const filteredEquipment = useMemo(
    () =>
      equipmentWithHealth.filter((eq) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const nameMatch = eq.name?.toLowerCase().includes(query);
          const typeMatch = eq.type?.toLowerCase().includes(query);
          const manufacturerMatch = eq.manufacturer?.toLowerCase().includes(query);
          const modelMatch = eq.model?.toLowerCase().includes(query);
          if (!nameMatch && !typeMatch && !manufacturerMatch && !modelMatch) {
            return false;
          }
        }
        if (vesselFilter !== "all" && eq.vesselId !== vesselFilter) {
          return false;
        }
        if (typeFilter !== "all" && eq.type !== typeFilter) {
          return false;
        }
        if (statusFilter !== "all") {
          const isActive = statusFilter === "active";
          const eqIsActive = eq.isActive ?? true;
          if (eqIsActive !== isActive) {
            return false;
          }
        }
        if (healthFilter !== "all") {
          const health = eq.health;
          if (healthFilter === "critical" && (!health || health.status !== "critical")) {
            return false;
          }
          if (healthFilter === "warning" && (!health || health.status !== "warning")) {
            return false;
          }
          if (healthFilter === "healthy" && (!health || health.status !== "healthy")) {
            return false;
          }
          if (healthFilter === "unknown" && health) {
            return false;
          }
        }
        return true;
      }),
    [equipmentWithHealth, searchQuery, vesselFilter, typeFilter, statusFilter, healthFilter]
  );

  const paginatedEquipment = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEquipment.slice(start, start + pageSize);
  }, [filteredEquipment, page, pageSize]);
  const totalPages = Math.ceil(filteredEquipment.length / pageSize);
  const stats = useMemo(() => {
    const total = equipmentWithHealth.length;
    const healthy = equipmentWithHealth.filter((e) => e.health?.status === "healthy").length;
    const warning = equipmentWithHealth.filter((e) => e.health?.status === "warning").length;
    const critical = equipmentWithHealth.filter((e) => e.health?.status === "critical").length;
    const noData = equipmentWithHealth.filter((e) => !e.health).length;
    const avgHealth =
      healthData.length > 0
        ? Math.round(
            healthData.reduce((sum, h) => sum + ((h['healthIndex'] as number) || 0), 0) / healthData.length
          )
        : 0;
    return { total, healthy, warning, critical, noData, avgHealth };
  }, [equipmentWithHealth, healthData]);

  const deleteEquipmentMutation = useDeleteMutation("/api/equipment", {
    successMessage: "Equipment deleted successfully",
    onError: (error) => {
      toast({
        title: "Error deleting equipment",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });
  const handleView = (equipment: EquipmentWithHealth) => {
    setSelectedEquipment(equipment);
    setIsDetailDrawerOpen(true);
  };
  const handleEdit = (equipment: EquipmentWithHealth) => {
    setSelectedEquipment(equipment);
    setIsEditDialogOpen(true);
  };
  const handleDelete = (equipment: EquipmentWithHealth) => {
    if (confirm(`Delete "${equipment.name}"? This cannot be undone.`)) {
      deleteEquipmentMutation.mutate(equipment.id);
    }
  };
  const handleSetupSensors = (equipment: EquipmentWithHealth) => {
    setSelectedEquipment(equipment);
    setIsSensorWizardOpen(true);
  };
  const clearFilters = () => {
    setSearchQuery("");
    setVesselFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setHealthFilter("all");
  };
  const hasActiveFilters =
    searchQuery ||
    vesselFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    healthFilter !== "all";
  const getVesselName = (vesselId: string | null) => {
    if (!vesselId) {
      return null;
    }
    const vessel = vessels.find((v) => v.id === vesselId);
    return vessel?.name || vesselId.slice(0, 8);
  };
  const isLoading = equipmentLoading && allEquipment.length === 0;

  useEffect(() => {
    setPage(1);
  }, [searchQuery, vesselFilter, typeFilter, statusFilter, healthFilter]);
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [filteredEquipment.length, totalPages, page]);

  return {
    selectedEquipment,
    setSelectedEquipment,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDetailDrawerOpen,
    setIsDetailDrawerOpen,
    isSensorWizardOpen,
    setIsSensorWizardOpen,
    searchQuery,
    setSearchQuery,
    vesselFilter,
    setVesselFilter,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    healthFilter,
    setHealthFilter,
    page,
    setPage,
    pageSize,
    vessels,
    uniqueTypes,
    paginatedEquipment,
    filteredEquipment,
    totalPages,
    stats,
    isLoading,
    handleView,
    handleEdit,
    handleDelete,
    handleSetupSensors,
    clearFilters,
    hasActiveFilters,
    getVesselName,
    refetchEquipment,
    setLocation,
  };
}
