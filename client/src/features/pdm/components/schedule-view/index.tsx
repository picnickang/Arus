import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useLocation, useSearch } from "wouter";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createHeaders, resolveUrl } from "@/lib/queryClient";
import { usePdmFilterOptions, usePdmSchedule, useCreateWorkOrderFromRisk } from "@/features/pdm";
import type { PdmScheduledTask, ScheduleFilters } from "@/features/pdm";
import { BlockedTasksSection } from "./BlockedTasksSection";
import { FilterBar } from "./FilterBar";
import { GanttScheduleView } from "./GanttScheduleView";
import { MoveTaskDialog } from "./MoveTaskDialog";
import { ScheduleKPIStrip } from "./ScheduleKPIStrip";
import { EmptyScheduleState, ErrorState, TelemetryStaleWarning } from "./StatusComponents";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { getWeekDateRange } from "./utils";

// useCreateWorkOrderFromRisk is re-exported here so that splitting this file
// doesn't change the public surface area of `@/features/pdm/components/schedule-view`.
export { useCreateWorkOrderFromRisk };

export function ScheduleView() {
  const search = useSearch();
  const [, setLocation] = useLocation();

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const initialWeekOffset = parseInt(params.get("week") || "0", 10);
  const initialVesselId = params.get("vesselId") || "all";
  const initialEquipmentType = params.get("equipmentType") || "all";
  const initialTaskId = params.get("taskId") || null;

  const initialMaxTasks = parseInt(params.get("maxTasks") || "3", 10);

  const initialAutoPopulate = params.get("autoPopulate") !== "false";

  const [weekOffset, setWeekOffset] = useState(initialWeekOffset);
  const [vesselId, setVesselId] = useState(initialVesselId);
  const [equipmentType, setEquipmentType] = useState(initialEquipmentType);
  const [maxTasksPerDay, setMaxTasksPerDay] = useState(initialMaxTasks);
  const [autoPopulate, setAutoPopulate] = useState(initialAutoPopulate);
  const [selectedTask, setSelectedTask] = useState<PdmScheduledTask | null>(null);
  const [moveTask, setMoveTask] = useState<PdmScheduledTask | null>(null);
  const [blockedPanelExpanded, setBlockedPanelExpanded] = useState(true);

  const { start, end } = getWeekDateRange(weekOffset);

  const filters: ScheduleFilters = useMemo(
    () => ({
      vesselIds: vesselId !== "all" ? [vesselId] : undefined,
      equipmentTypes: equipmentType !== "all" ? [equipmentType] : undefined,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      maxTasksPerVesselPerDay: maxTasksPerDay,
      autoPopulate,
    }),
    [vesselId, equipmentType, start, end, maxTasksPerDay, autoPopulate]
  );

  const { data, isLoading, isError, refetch } = usePdmSchedule(filters);
  const { data: filterOptions, isLoading: filterOptionsLoading } = usePdmFilterOptions();

  const updateUrl = useCallback(
    (
      newWeek: number,
      newVessel: string,
      newEquipType: string,
      newMaxTasks: number,
      newAutoPopulate: boolean
    ) => {
      const newParams = new URLSearchParams();
      if (newWeek !== 0) {
        newParams.set("week", newWeek.toString());
      }
      if (newVessel !== "all") {
        newParams.set("vesselId", newVessel);
      }
      if (newEquipType !== "all") {
        newParams.set("equipmentType", newEquipType);
      }
      if (newMaxTasks !== 3) {
        newParams.set("maxTasks", newMaxTasks.toString());
      }
      if (!newAutoPopulate) {
        newParams.set("autoPopulate", "false");
      }
      const queryString = newParams.toString();
      setLocation(queryString ? `?${queryString}` : "", { replace: true });
    },
    [setLocation]
  );

  const handleWeekChange = useCallback(
    (offset: number) => {
      setWeekOffset(offset);
      updateUrl(offset, vesselId, equipmentType, maxTasksPerDay, autoPopulate);
    },
    [vesselId, equipmentType, maxTasksPerDay, autoPopulate, updateUrl]
  );

  const handleVesselChange = useCallback(
    (id: string) => {
      setVesselId(id);
      updateUrl(weekOffset, id, equipmentType, maxTasksPerDay, autoPopulate);
    },
    [weekOffset, equipmentType, maxTasksPerDay, autoPopulate, updateUrl]
  );

  const handleEquipmentTypeChange = useCallback(
    (type: string) => {
      setEquipmentType(type);
      updateUrl(weekOffset, vesselId, type, maxTasksPerDay, autoPopulate);
    },
    [weekOffset, vesselId, maxTasksPerDay, autoPopulate, updateUrl]
  );

  const handleMaxTasksChange = useCallback(
    (value: number) => {
      setMaxTasksPerDay(value);
      updateUrl(weekOffset, vesselId, equipmentType, value, autoPopulate);
    },
    [weekOffset, vesselId, equipmentType, autoPopulate, updateUrl]
  );

  const handleAutoPopulateChange = useCallback(
    (enabled: boolean) => {
      setAutoPopulate(enabled);
      updateUrl(weekOffset, vesselId, equipmentType, maxTasksPerDay, enabled);
    },
    [weekOffset, vesselId, equipmentType, maxTasksPerDay, updateUrl]
  );

  useEffect(() => {
    if (initialTaskId && data) {
      const task = [...(data.scheduledTasks || []), ...(data.blockedTasks || [])].find(
        (t) => t.id === initialTaskId
      );
      if (task) {
        setSelectedTask(task);
      }
    }
  }, [initialTaskId, data]);

  const handleExportCsv = async () => {
    try {
      const exportParams = new URLSearchParams();
      exportParams.set("format", "csv");
      if (filters.vesselIds?.length) {
        exportParams.set("vesselIds", filters.vesselIds.join(","));
      }
      if (filters.equipmentTypes?.length) {
        exportParams.set("equipmentTypes", filters.equipmentTypes.join(","));
      }
      if (filters.startDate) {
        exportParams.set("startDate", filters.startDate);
      }
      if (filters.endDate) {
        exportParams.set("endDate", filters.endDate);
      }

      const response = await fetch(resolveUrl(`/api/pdm/export/schedule?${exportParams.toString()}`), {
        credentials: "include",
        headers: { ...createHeaders(false), Accept: "text/csv" },
      });
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pdm-schedule-${format(start, "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export schedule:", error);
    }
  };

  const handleMoveConfirm = (_newDate: Date, _isOverride: boolean) => {
    // Disabled at the action button until the schedule-write API is available.
    setMoveTask(null);
  };

  const handleKpiScheduledClick = useCallback(() => {
    setBlockedPanelExpanded(false);
  }, []);

  const handleKpiUnassignedClick = useCallback(() => {
    setBlockedPanelExpanded(true);
  }, []);

  const telemetryStaleCount = useMemo(() => {
    return (data?.blockedTasks || []).filter((t) => t.blockReason === "telemetry_stale").length;
  }, [data?.blockedTasks]);

  const hasScheduledTasks = (data?.scheduledTasks?.length ?? 0) > 0;
  const hasBlockedTasks = (data?.blockedTasks?.length ?? 0) > 0;

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <FilterBar
          weekOffset={weekOffset}
          onWeekChange={handleWeekChange}
          vesselId={vesselId}
          onVesselChange={handleVesselChange}
          equipmentType={equipmentType}
          onEquipmentTypeChange={handleEquipmentTypeChange}
          maxTasksPerDay={maxTasksPerDay}
          onMaxTasksChange={handleMaxTasksChange}
          autoPopulate={autoPopulate}
          onAutoPopulateChange={handleAutoPopulateChange}
          vessels={filterOptions?.vessels ?? []}
          equipmentTypes={filterOptions?.equipmentTypes ?? []}
          isLoading={filterOptionsLoading}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="flex-shrink-0"
          data-testid="btn-export-schedule"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <TelemetryStaleWarning count={telemetryStaleCount} />

      <ScheduleKPIStrip
        kpis={data?.kpis}
        isLoading={isLoading}
        onScheduledClick={hasScheduledTasks ? handleKpiScheduledClick : undefined}
        onUnassignedClick={hasBlockedTasks ? handleKpiUnassignedClick : undefined}
      />

      {!isLoading && !hasScheduledTasks ? (
        <EmptyScheduleState hasBlockedTasks={hasBlockedTasks} />
      ) : (
        <GanttScheduleView
          tasks={data?.scheduledTasks ?? []}
          vessels={filterOptions?.vessels ?? data?.vessels ?? []}
          dateRange={data?.dateRange ?? { start, end }}
          onSelectTask={setSelectedTask}
          isLoading={isLoading}
        />
      )}

      <BlockedTasksSection
        tasks={data?.blockedTasks ?? []}
        onSelectTask={setSelectedTask}
        isLoading={isLoading}
        isExpanded={blockedPanelExpanded}
        onExpandChange={setBlockedPanelExpanded}
      />

      <TaskDetailPanel
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onMoveTask={setMoveTask}
      />

      <MoveTaskDialog
        task={moveTask}
        isOpen={!!moveTask}
        onClose={() => setMoveTask(null)}
        onConfirm={handleMoveConfirm}
      />
    </div>
  );
}

export default ScheduleView;
