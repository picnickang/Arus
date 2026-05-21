import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import { useWebSocket } from "@/hooks/useWebSocket";
import { queryClient } from "@/lib/queryClient";
import { formatTimeSgt } from "@/lib/time-utils";
import { useDashboardSummary } from "./useDashboardSummary";

export function useDashboardData() {
  const [alertBanner, setAlertBanner] = useState<{ type: string; message: string } | null>(null);
  const { toast } = useToast();
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const { preferences, updatePreference } = useDashboardPreferences();
  const [selectedVessel, setSelectedVessel] = useState<string>(preferences.vesselFilter);
  const [, _setLocation] = useLocation();
  const [deviceStatusExpanded, setDeviceStatusExpanded] = useState(true);
  const [telemetryExpanded, setTelemetryExpanded] = useState(true);
  const [predictiveMaintenanceExpanded, setPredictiveMaintenanceExpanded] = useState(true);
  const [workOrdersExpanded, setWorkOrdersExpanded] = useState(true);
  const { isConnected, latestAlert, subscribe, unsubscribe } = useWebSocket({ autoConnect: true });

  const {
    metrics,
    devices,
    equipmentHealth,
    workOrders,
    vessels: allVessels,
    equipment: equipmentRegistry,
    latestTelemetry,
    dtcStats,
    operatingAlerts,
    insightsSnapshot,
    insightsJobStats,
    stcwSummary,
    stcwTrends,
    isLoading: summaryLoading,
    error: summaryError,
  } = useDashboardSummary();
  const metricsLoading = summaryLoading;
  const devicesLoading = summaryLoading;
  const healthLoading = summaryLoading;
  const ordersLoading = summaryLoading;

  const latestReadings = latestTelemetry;
  const latestReadingsLoading = summaryLoading;

  const currentTime = `${formatTimeSgt(new Date())} SGT`;
  const equipmentHealthArray = Array.isArray(equipmentHealth) ? equipmentHealth : [];
  const criticalEquipmentCount = equipmentHealthArray.filter((eq) => eq.healthIndex < 30).length;
  const criticalWorkOrdersCount = (Array.isArray(workOrders) ? workOrders : []).filter(
    (wo) =>
      (wo.priority === "high" || wo.priority === "2" || wo.priority === 2) &&
      wo.status !== "completed"
  ).length;
  const totalCriticalIssues =
    criticalEquipmentCount + criticalWorkOrdersCount + (metrics?.riskAlerts || 0);
  const criticalEquipment = equipmentHealthArray.filter((eq) => eq.healthIndex < 30);
  const criticalWorkOrders =
    workOrders?.filter(
      (wo) =>
        (wo.priority === "high" || wo.priority === "2" || wo.priority === 2) &&
        wo.status !== "completed"
    ) ?? [];

  const getVesselName = (vesselId: string): string => {
    if (vesselId === "all") {
      return "All Vessels";
    }
    const vessel = allVessels?.find((v) => v.id === vesselId);
    return vessel?.name || vesselId;
  };
  const getEquipmentName = (equipmentId: string | null | undefined): string => {
    if (!equipmentId) {
      return "Unknown";
    }
    const eqHealthArray = Array.isArray(equipmentHealth) ? equipmentHealth : [];
    const healthItem = eqHealthArray.find((eq) => eq.id === equipmentId);
    if (healthItem?.name) {
      return healthItem.name;
    }
    const equipment = equipmentRegistry?.find((eq) => eq.id === equipmentId);
    if (equipment?.name) {
      return equipment.name;
    }
    return equipmentId;
  };
  const getPriorityText = (priority: string | number | null | undefined): string => {
    if (priority === null || priority === undefined) {
      return "N/A";
    }
    const priorityStr = String(priority).toLowerCase();
    if (priorityStr === "high" || priorityStr === "2") {
      return "HIGH";
    }
    if (priorityStr === "medium" || priorityStr === "1") {
      return "MEDIUM";
    }
    if (priorityStr === "low" || priorityStr === "0") {
      return "LOW";
    }
    return String(priority).toUpperCase();
  };
  const shouldShowSection = (sectionType: "critical" | "normal") => {
    if (!isFocusMode) {
      return true;
    }
    return sectionType === "critical";
  };
  const refreshData = () => {
    toast({ title: "Refreshing data...", description: "Dashboard data is being updated" });
    queryClient.invalidateQueries();
    setTimeout(() => {
      toast({ title: "Data refreshed", description: "Dashboard updated successfully" });
    }, 500);
  };
  const dismissAlert = () => setAlertBanner(null);

  useEffect(() => {
    if (isConnected) {
      subscribe("alerts");
      subscribe("dashboard");
    }
    return () => {
      unsubscribe("alerts");
      unsubscribe("dashboard");
    };
  }, [isConnected, subscribe, unsubscribe]);

  useEffect(() => {
    if (latestAlert && !latestAlert.acknowledged) {
      setAlertBanner(latestAlert as object as { type: string; message: string });
      const alertType = latestAlert.alertType || "info";
      toast({
        title: `${alertType.toUpperCase()} Alert`,
        description: latestAlert.message,
        variant: alertType === "critical" ? "destructive" : "default",
      });
      if (alertType !== "critical") {
        setTimeout(() => setAlertBanner(null), 10000);
      }
    }
  }, [latestAlert, toast]);

  useEffect(() => {
    if (allVessels?.length > 0) {
      const isValidFilter =
        selectedVessel === "all" || allVessels.some((v) => v.id === selectedVessel);
      if (!isValidFilter) {
        setSelectedVessel("all");
      }
    }
  }, [allVessels]);
  useEffect(() => {
    updatePreference("vesselFilter", selectedVessel);
  }, [selectedVessel, updatePreference]);
  useEffect(() => {
    if (isFocusMode) {
      setDeviceStatusExpanded(false);
      setTelemetryExpanded(false);
      setPredictiveMaintenanceExpanded(criticalEquipmentCount > 0);
      setWorkOrdersExpanded(criticalWorkOrdersCount > 0);
    } else {
      setDeviceStatusExpanded(true);
      setTelemetryExpanded(true);
      setPredictiveMaintenanceExpanded(true);
      setWorkOrdersExpanded(true);
    }
  }, [isFocusMode]);

  return {
    alertBanner,
    metrics,
    metricsLoading,
    summaryError,
    devices,
    devicesLoading,
    equipmentHealth,
    equipmentHealthArray,
    healthLoading,
    workOrders,
    ordersLoading,
    allVessels,
    latestReadings,
    latestReadingsLoading,
    dtcStats,
    currentTime,
    preferences,
    criticalEquipmentCount,
    criticalWorkOrdersCount,
    totalCriticalIssues,
    criticalEquipment,
    criticalWorkOrders,
    selectedVessel,
    setSelectedVessel,
    isConnected,
    isFocusMode,
    toggleFocusMode,
    deviceStatusExpanded,
    setDeviceStatusExpanded,
    telemetryExpanded,
    setTelemetryExpanded,
    predictiveMaintenanceExpanded,
    setPredictiveMaintenanceExpanded,
    workOrdersExpanded,
    setWorkOrdersExpanded,
    getVesselName,
    getEquipmentName,
    getPriorityText,
    shouldShowSection,
    refreshData,
    dismissAlert,
    operatingAlerts,
    insightsSnapshot,
    insightsJobStats,
    stcwSummary,
    stcwTrends,
    equipmentRegistry,
  };
}
