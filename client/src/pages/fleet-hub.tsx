import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Gauge, Loader2, RefreshCw, Ship, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  belongsToVessel,
  sectionMapDefinitionFromRegistry,
  toArray,
  vesselIdFor,
  vesselNameFor,
  type EquipmentRecord,
  type PdmDashboardRecord,
  type RegistrySummaryRecord,
  type VesselIntelligenceAlertRecord,
  type VesselIntelligenceWorkOrderRecord,
  type VesselRecord,
} from "./vessel-intelligence/data";
import { buildFleetTriageViewModel } from "./vessel-intelligence/fleet-triage-model";
import {
  FleetActionBoard,
  FleetMapStatus,
  FleetPriorityList,
  FleetRegistryAccessPanel,
  FleetTriagePanel,
  FleetVesselDiagramPreview,
  severityClasses,
} from "./vessel-intelligence/fleet-triage-components";

function redirectedFleetTarget(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = params.get("tab");
  if (tab === "vessels") {
    return "/vessel-management";
  }
  if (tab === "equipment") {
    return "/equipment";
  }
  return null;
}

export default function FleetPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const redirectedTarget = redirectedFleetTarget(searchString);

  useEffect(() => {
    if (redirectedTarget) {
      setLocation(redirectedTarget, { replace: true });
    }
  }, [redirectedTarget, setLocation]);

  const vesselsQuery = useQuery({
    queryKey: ["/api/vessels"],
    queryFn: () => apiRequest<unknown>("GET", "/api/vessels"),
    enabled: !redirectedTarget,
  });
  const equipmentQuery = useQuery({
    queryKey: ["/api/equipment"],
    queryFn: () => apiRequest<unknown>("GET", "/api/equipment"),
    enabled: !redirectedTarget,
  });
  const workOrdersQuery = useQuery({
    queryKey: ["/api/work-orders"],
    queryFn: () => apiRequest<unknown>("GET", "/api/work-orders"),
    enabled: !redirectedTarget,
  });
  const alertsQuery = useQuery({
    queryKey: ["/api/alerts"],
    queryFn: () => apiRequest<unknown>("GET", "/api/alerts"),
    enabled: !redirectedTarget,
  });
  const pdmQuery = useQuery({
    queryKey: ["/api/pdm/dashboard"],
    queryFn: () => apiRequest<PdmDashboardRecord>("GET", "/api/pdm/dashboard"),
    enabled: !redirectedTarget,
  });

  const vessels = toArray<VesselRecord>(vesselsQuery.data);
  const equipment = toArray<EquipmentRecord>(equipmentQuery.data);
  const workOrders = toArray<VesselIntelligenceWorkOrderRecord>(workOrdersQuery.data);
  const alerts = toArray<VesselIntelligenceAlertRecord>(alertsQuery.data);

  const summaryQueries = useQueries({
    queries: vessels.map((vessel) => {
      const vesselId = vesselIdFor(vessel);
      return {
        queryKey: ["/api/vessel-intelligence", vesselId, "summary"],
        queryFn: () =>
          apiRequest<RegistrySummaryRecord>("GET", `/api/vessel-intelligence/${vesselId}/summary`),
        enabled: Boolean(vesselId) && !redirectedTarget,
      };
    }),
  });

  if (redirectedTarget) {
    return null;
  }

  const summariesByVesselId: Record<string, RegistrySummaryRecord | undefined> = {};
  vessels.forEach((vessel, index) => {
    summariesByVesselId[vesselIdFor(vessel)] = summaryQueries[index]?.data;
  });

  const model = buildFleetTriageViewModel({
    vessels,
    equipment,
    workOrders,
    alerts,
    summariesByVesselId,
  });
  const selectedVesselId = model.priorityVesselId || vesselIdFor(vessels[0]);
  const selectedVessel =
    vessels.find((vessel) => vesselIdFor(vessel) === selectedVesselId) ?? vessels[0];
  const selectedSummary = selectedVesselId ? summariesByVesselId[selectedVesselId] : undefined;
  const selectedSideElevationDiagram =
    selectedSummary?.diagrams.find((diagram) => diagram.diagramType === "side_elevation") ??
    (selectedSummary?.activeDiagram?.diagramType === "side_elevation"
      ? selectedSummary.activeDiagram
      : undefined);
  const selectedActiveDiagram = selectedSideElevationDiagram ?? selectedSummary?.activeDiagram;
  const selectedSectionMap =
    sectionMapDefinitionFromRegistry(selectedSummary?.activeSectionMap) ??
    sectionMapDefinitionFromRegistry(selectedSummary?.sectionMaps[0]);
  const selectedDiagramMediaUrl =
    selectedVesselId && selectedActiveDiagram?.id && selectedActiveDiagram.activeVersionId
      ? `/api/vessel-intelligence/${selectedVesselId}/diagrams/${selectedActiveDiagram.id}/versions/${selectedActiveDiagram.activeVersionId}/media`
      : undefined;
  const isLoading =
    vesselsQuery.isLoading ||
    equipmentQuery.isLoading ||
    workOrdersQuery.isLoading ||
    alertsQuery.isLoading ||
    summaryQueries.some((query) => query.isLoading);
  const hasLiveDataError =
    vesselsQuery.isError ||
    equipmentQuery.isError ||
    workOrdersQuery.isError ||
    alertsQuery.isError ||
    pdmQuery.isError ||
    summaryQueries.some((query) => query.isError);
  const linkedEquipment = selectedVesselId
    ? equipment.filter((item) => belongsToVessel(item, selectedVesselId)).length
    : equipment.length;

  const refetchAll = () => {
    void vesselsQuery.refetch();
    void equipmentQuery.refetch();
    void workOrdersQuery.refetch();
    void alertsQuery.refetch();
    void pdmQuery.refetch();
    summaryQueries.forEach((query) => void query.refetch());
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4" data-testid="fleet-triage-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="secondary">Fleet & Vessel Intelligence</Badge>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-50">
            Fleet Triage
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Fleet technical triage with existing vessel drill-down routes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-sky-900/70 bg-[#0a2238] text-slate-100 hover:bg-sky-500/15"
          onClick={refetchAll}
          data-testid="button-refresh-fleet-triage"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {hasLiveDataError && (
        <div
          className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100"
          data-testid="fleet-triage-data-error"
        >
          Some fleet feeds did not load. Visible counts only reflect the live data currently
          available.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-sky-900/70 bg-[#0a1d31] p-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
          Loading fleet triage feeds...
        </div>
      )}

      <section className="order-2 grid gap-4 lg:order-1 lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)_minmax(260px,0.7fr)]">
        <FleetPriorityList vessels={model.vessels} onOpenVessel={setLocation} />
        <FleetMapStatus markers={model.markers} onOpenMarker={setLocation} />
        <FleetTriagePanel testId="global-queue">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">Global Queue</h2>
              <p className="mt-1 text-xs text-slate-400">Counts from live queue inputs.</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-sky-300" />
          </div>
          <div className="space-y-2">
            {model.queue.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md border border-sky-900/70 bg-[#08192a] px-3 py-2 text-left transition-colors hover:border-sky-500/50 hover:bg-sky-500/10"
                onClick={() => setLocation(item.href)}
                data-testid={`global-queue-${item.id}`}
              >
                <span className="text-xs text-slate-300">{item.label}</span>
                <Badge className={severityClasses(item.severity)} variant="outline">
                  {item.value}
                </Badge>
              </button>
            ))}
          </div>
        </FleetTriagePanel>
      </section>

      <section
        className="order-3 grid gap-4 md:grid-cols-2 lg:order-2 xl:grid-cols-4"
        data-testid="fleet-kpi-cards"
      >
        {model.kpis.map((card) => (
          <FleetTriagePanel key={card.id} testId={`fleet-kpi-${card.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{card.value}</p>
              </div>
              <Badge className={severityClasses(card.severity)} variant="outline">
                {card.trendLabel}
              </Badge>
            </div>
          </FleetTriagePanel>
        ))}
      </section>

      <section className="order-1 grid gap-4 lg:order-3 lg:grid-cols-3">
        <FleetVesselDiagramPreview
          vesselName={vesselNameFor(selectedVessel)}
          diagramTitle={selectedActiveDiagram?.title}
          mediaUrl={selectedDiagramMediaUrl}
          sectionMap={selectedSectionMap}
          sideElevationStatus={
            model.vessels.find((vessel) => vessel.vesselId === selectedVesselId)
              ?.sideElevationStatus ?? "not_uploaded"
          }
          onOpenDiagram={() =>
            setLocation(
              selectedVesselId
                ? `/vessel-intelligence/${selectedVesselId}/overview`
                : "/vessel-intelligence"
            )
          }
          onReplaceSideElevation={() =>
            setLocation(
              selectedVesselId && selectedSideElevationDiagram?.id
                ? `/vessel-intelligence/${selectedVesselId}/diagrams/${selectedSideElevationDiagram.id}`
                : selectedVesselId
                  ? `/vessel-intelligence/${selectedVesselId}/diagrams`
                  : "/vessel-intelligence"
            )
          }
        />
        <FleetTriagePanel testId="fleet-data-freshness">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">Data freshness</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                {model.dataFreshnessPercent === null ? "No data" : `${model.dataFreshnessPercent}%`}
              </p>
            </div>
            <Gauge className="h-5 w-5 text-sky-300" />
          </div>
        </FleetTriagePanel>
        <FleetTriagePanel testId="fleet-equipment-context">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">Priority vessel equipment</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{linkedEquipment}</p>
            </div>
            <Wrench className="h-5 w-5 text-sky-300" />
          </div>
        </FleetTriagePanel>
        <FleetTriagePanel testId="fleet-drilldown-context">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">Drill-down target</p>
              <p className="mt-2 text-sm font-semibold text-slate-50">
                Vessel Intelligence workflows
              </p>
            </div>
            <Ship className="h-5 w-5 text-sky-300" />
          </div>
        </FleetTriagePanel>
      </section>

      <div className="order-4">
        <FleetRegistryAccessPanel
          vesselCount={vessels.length}
          equipmentCount={equipment.length}
          priorityVesselId={selectedVesselId}
          sideElevationStatus={
            model.vessels.find((vessel) => vessel.vesselId === selectedVesselId)
              ?.sideElevationStatus ?? "not_uploaded"
          }
          onOpen={setLocation}
        />
      </div>

      <div className="order-5">
        <FleetActionBoard rows={model.actionRows} onOpenRow={setLocation} />
      </div>
    </div>
  );
}
