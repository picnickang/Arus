import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, Layers, RefreshCw, Wrench } from "lucide-react";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { SectionedVesselMap } from "./SectionedVesselMap";
import { SECTION_MAP, type DiagramTypeKey, type VesselSectionMapDefinition } from "./registry";
import {
  AlertsPanel,
  DiagramRegistryPanel,
  EquipmentMappingPanel,
  MetricPanel,
  RegistryAdministrationPanels,
  ReportsPanel,
  WorkOrdersPanel,
} from "./panels";
import { RegistryRouteScreen, isRegistryRoute } from "./registry-screens";
import {
  belongsToVessel,
  statusText,
  toArray,
  vesselIdFor,
  vesselNameFor,
  type VesselIntelligenceAlertRecord,
  type EquipmentRecord,
  type PdmDashboardRecord,
  type RegistrySectionMapRecord,
  type RegistrySummaryRecord,
  type VesselRecord,
  type VesselIntelligenceWorkOrderRecord,
} from "./data";

type HubMode =
  | "overview"
  | "sections"
  | "maintenance"
  | "alerts"
  | "performance"
  | "reports"
  | "diagrams"
  | "settings";

interface VesselIntelligencePageProps {
  vesselId?: string;
  sectionId?: string;
  equipmentId?: string;
  workOrderId?: string;
  diagramId?: string;
  mapId?: string;
}

interface HubTab {
  value: HubMode;
  label: string;
}

const HUB_TABS: HubTab[] = [
  { value: "overview", label: "Overview" },
  { value: "sections", label: "Sections" },
  { value: "maintenance", label: "Maintenance" },
  { value: "alerts", label: "Alerts" },
  { value: "performance", label: "Performance" },
  { value: "reports", label: "Reports" },
  { value: "diagrams", label: "Diagrams" },
  { value: "settings", label: "Settings" },
];

function modeFromPath(path: string): HubMode {
  const target = new URLSearchParams(path.split("?")[1] ?? "").get("target");
  if (target === "sections" || target === "performance" || target === "alerts") {
    return target;
  }
  if (target === "overview") {
    return "overview";
  }
  if (path.includes("/sections") || path.includes("/equipment/")) {
    return "sections";
  }
  if (path.includes("/maintenance")) {
    return "maintenance";
  }
  if (path.includes("/alerts")) {
    return "alerts";
  }
  if (path.includes("/performance") || path.includes("/health")) {
    return "performance";
  }
  if (path.includes("/reports")) {
    return "reports";
  }
  if (
    path.includes("/diagrams") ||
    path.includes("/section-maps") ||
    path.includes("/thumbnails")
  ) {
    return "diagrams";
  }
  if (path.includes("/settings")) {
    return "settings";
  }
  return "overview";
}

function pathForMode(vesselId: string, mode: HubMode): string {
  const root = vesselId ? `/vessel-intelligence/${vesselId}` : "/vessel-intelligence";
  if (mode === "overview") {
    return vesselId ? `${root}/overview` : root;
  }
  return `${root}/${mode}`;
}

function sectionMapFromRegistry(
  map: RegistrySectionMapRecord | null | undefined
): VesselSectionMapDefinition | null {
  if (!map || map.coordinateMode !== "normalized_percent" || map.sections.length === 0) {
    return null;
  }
  return {
    coordinateMode: "normalized_percent",
    diagramWidth: map.diagramWidth,
    diagramHeight: map.diagramHeight,
    diagramKind: (map.diagramKind || "side_elevation") as DiagramTypeKey,
    sections: map.sections.map((section) => ({
      sectionNo: section.sectionNo,
      sectionKey: section.sectionKey,
      name: section.name,
      color: section.color,
      polygonNormalized: section.polygonNormalized,
      labelNormalized: section.labelNormalized,
      equipment: section.equipment.map((assignment) => assignment.equipmentName),
      thumbnailFallback:
        section.thumbnailFallback ??
        "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    })),
  };
}

export default function VesselIntelligencePage({
  vesselId: routeVesselId,
  sectionId,
  diagramId,
  mapId,
}: VesselIntelligencePageProps) {
  const [location, setLocation] = useLocation();
  const { hasAnyPermission } = usePermissions();
  const mode = modeFromPath(location);
  const canManageDiagrams = hasAnyPermission("vessel-intelligence", [
    "configure",
    "upload-diagram",
    "rollback-diagram",
    "replace-section-thumbnail",
    "replace-equipment-thumbnail",
  ]);
  const canManageRegistry = hasAnyPermission("vessel-intelligence", [
    "configure",
    "edit-section-map",
    "publish-map",
    "assign-equipment",
  ]);

  const vesselsQuery = useQuery({
    queryKey: ["/api/vessels"],
    queryFn: () => apiRequest<unknown>("GET", "/api/vessels"),
  });
  const equipmentQuery = useQuery({
    queryKey: ["/api/equipment"],
    queryFn: () => apiRequest<unknown>("GET", "/api/equipment"),
  });
  const workOrdersQuery = useQuery({
    queryKey: ["/api/work-orders"],
    queryFn: () => apiRequest<unknown>("GET", "/api/work-orders"),
  });
  const alertsQuery = useQuery({
    queryKey: ["/api/alerts"],
    queryFn: () => apiRequest<unknown>("GET", "/api/alerts"),
  });
  const pdmQuery = useQuery({
    queryKey: ["/api/pdm/dashboard"],
    queryFn: () => apiRequest<PdmDashboardRecord>("GET", "/api/pdm/dashboard"),
  });

  const vessels = toArray<VesselRecord>(vesselsQuery.data);
  const equipment = toArray<EquipmentRecord>(equipmentQuery.data);
  const workOrders = toArray<VesselIntelligenceWorkOrderRecord>(workOrdersQuery.data);
  const alerts = toArray<VesselIntelligenceAlertRecord>(alertsQuery.data);

  const selectedVessel =
    vessels.find((vessel) => vesselIdFor(vessel) === routeVesselId) ?? vessels[0];
  const selectedVesselId = routeVesselId ?? vesselIdFor(selectedVessel);

  const registryQuery = useQuery({
    queryKey: ["/api/vessel-intelligence", selectedVesselId, "summary"],
    queryFn: () =>
      apiRequest<RegistrySummaryRecord>(
        "GET",
        `/api/vessel-intelligence/${selectedVesselId}/summary`
      ),
    enabled: Boolean(selectedVesselId),
  });

  const activeSectionMap =
    sectionMapFromRegistry(registryQuery.data?.activeSectionMap) ??
    sectionMapFromRegistry(registryQuery.data?.sectionMaps[0]) ??
    SECTION_MAP;
  const activeDiagram = registryQuery.data?.activeDiagram;
  const activeDiagramBaseUrl =
    selectedVesselId && activeDiagram?.id && activeDiagram.activeVersionId
      ? `/api/vessel-intelligence/${selectedVesselId}/diagrams/${activeDiagram.id}/versions/${activeDiagram.activeVersionId}/media`
      : undefined;
  const selectedSectionKey = sectionId ?? activeSectionMap.sections[0]?.sectionKey ?? "";
  const vesselEquipment = equipment.filter((item) => belongsToVessel(item, selectedVesselId));
  const vesselWorkOrders = workOrders.filter((item) => belongsToVessel(item, selectedVesselId));
  const vesselAlerts = alerts.filter((item) => belongsToVessel(item, selectedVesselId));
  const liveDataError =
    vesselsQuery.isError ||
    equipmentQuery.isError ||
    workOrdersQuery.isError ||
    alertsQuery.isError ||
    pdmQuery.isError ||
    registryQuery.isError;

  const handleSelectVessel = (nextVesselId: string) => {
    setLocation(`/vessel-intelligence/${nextVesselId}/overview`);
  };

  const handleSelectSection = (nextSectionKey: string) => {
    const targetVesselId = selectedVesselId;
    setLocation(
      targetVesselId
        ? `/vessel-intelligence/${targetVesselId}/sections/${nextSectionKey}`
        : "/vessel-intelligence"
    );
  };
  const buildPath = (nextMode: string) => pathForMode(selectedVesselId, nextMode as HubMode);
  let pdmStatusLabel = "Connected";
  if (pdmQuery.isLoading) {
    pdmStatusLabel = "Loading";
  } else if (pdmQuery.isError) {
    pdmStatusLabel = "Unavailable";
  }

  if (selectedVesselId && isRegistryRoute(location)) {
    return (
      <RegistryRouteScreen
        vesselId={selectedVesselId}
        diagramId={diagramId}
        mapId={mapId}
        vessels={vessels}
        selectedVessel={selectedVessel}
        equipment={vesselEquipment}
        onSelectVessel={(nextVesselId) => setLocation(`/vessel-intelligence/${nextVesselId}/diagrams`)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="vessel-intelligence-hub">
      <PageHeader
        title="Vessel Intelligence"
        subtitle="Live vessel data, section maps, equipment context, and replaceable diagram registry"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void vesselsQuery.refetch();
              void equipmentQuery.refetch();
              void workOrdersQuery.refetch();
              void alertsQuery.refetch();
              void pdmQuery.refetch();
            }}
            data-testid="button-refresh-vessel-intelligence"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 lg:px-6">
        {liveDataError && (
          <div
            className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            data-testid="vessel-intelligence-data-error"
          >
            Some live ARUS data did not load. The design registry still renders, but operational
            counts may be incomplete.
          </div>
        )}

        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-md border p-4">
            <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <Badge variant="secondary">Full Hub v2</Badge>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal">
                  {vesselNameFor(selectedVessel)}
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Consolidates fleet technical triage, sectioned vessel maps, equipment health,
                  maintenance, alerts, reports, and diagram administration without replacing crew,
                  logistics, inventory, safety, system admin, or user dashboards.
                </p>
              </div>

              <div className="w-full md:w-72">
                <label className="mb-2 block text-xs font-medium uppercase text-muted-foreground">
                  Vessel
                </label>
                <Select
                  value={selectedVesselId}
                  onValueChange={handleSelectVessel}
                  disabled={vessels.length === 0}
                >
                  <SelectTrigger data-testid="select-vessel-intelligence-vessel">
                    <SelectValue placeholder="No vessels available" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels.map((vessel) => {
                      const id = vesselIdFor(vessel);
                      return (
                        <SelectItem key={id} value={id}>
                          {vesselNameFor(vessel)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs
              value={mode}
              onValueChange={(value) =>
                setLocation(pathForMode(selectedVesselId, value as HubMode))
              }
              className="mt-5 min-w-0"
            >
              <TabsList
                className="flex h-auto max-w-full min-w-0 justify-start overflow-x-auto"
                data-testid="vessel-intelligence-tabs"
              >
                {HUB_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div
            className="min-w-0 rounded-md border p-4"
            data-testid="vessel-intelligence-data-sources"
          >
            <h2 className="text-sm font-semibold">Live source bindings</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Vessels</span>
                <span>{vesselsQuery.isLoading ? "Loading" : `${vessels.length} records`}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Equipment</span>
                <span>
                  {equipmentQuery.isLoading ? "Loading" : `${vesselEquipment.length} linked`}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Work orders</span>
                <span>
                  {workOrdersQuery.isLoading ? "Loading" : `${vesselWorkOrders.length} linked`}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Alerts</span>
                <span>{alertsQuery.isLoading ? "Loading" : `${vesselAlerts.length} linked`}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">PdM</span>
                <span>{pdmStatusLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Registry</span>
                <span>
                  {registryQuery.isLoading
                    ? "Loading"
                    : `${registryQuery.data?.sectionMaps.length ?? 0} maps`}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4"
          data-testid="vessel-intelligence-metrics"
        >
          <MetricPanel
            label="Registry sections"
            value={activeSectionMap.sections.length}
            icon={Layers}
            note={
              registryQuery.data?.activeSectionMap
                ? "From published section map API"
                : "Design package fallback until a map is published"
            }
            testId="metric-section-count"
          />
          <MetricPanel
            label="Linked equipment"
            value={vesselEquipment.length}
            icon={Wrench}
            note="From /api/equipment for the selected vessel"
            testId="metric-equipment-count"
          />
          <MetricPanel
            label="Open technical work"
            value={vesselWorkOrders.length}
            icon={ClipboardCheck}
            note="From /api/work-orders without fabricated counts"
            testId="metric-work-order-count"
          />
          <MetricPanel
            label="Active alerts"
            value={vesselAlerts.length}
            icon={AlertTriangle}
            note="From /api/alerts for operational triage"
            testId="metric-alert-count"
          />
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="min-w-0 rounded-md border p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Sectioned Vessel Map</h2>
                <p className="text-sm text-muted-foreground">
                  Editable normalized polygons from the supplied Full Hub v2 package.
                </p>
              </div>
              <Badge variant="outline">{statusText(activeSectionMap.diagramKind)}</Badge>
            </div>
            <SectionedVesselMap
              sectionMap={activeSectionMap}
              selectedSectionKey={selectedSectionKey}
              baseImageUrl={activeDiagramBaseUrl}
              onSelectSection={handleSelectSection}
            />
          </div>

          <div className="min-w-0 space-y-4">
            <DiagramRegistryPanel
              selectedVesselId={selectedVesselId}
              diagrams={registryQuery.data?.diagrams ?? []}
              buildPath={buildPath}
              canManageDiagrams={canManageDiagrams}
            />
            <EquipmentMappingPanel
              selectedVesselId={selectedVesselId}
              vesselEquipment={vesselEquipment}
              sectionMap={activeSectionMap}
              buildPath={buildPath}
            />
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-3">
          <WorkOrdersPanel
            selectedVesselId={selectedVesselId}
            vesselWorkOrders={vesselWorkOrders}
            buildPath={buildPath}
          />
          <AlertsPanel vesselAlerts={vesselAlerts} buildPath={buildPath} />
          <ReportsPanel
            pdmUnavailable={pdmQuery.isError}
            buildPath={buildPath}
            canManageRegistry={canManageRegistry}
          />
        </section>

        {canManageRegistry && <RegistryAdministrationPanels />}
      </div>
    </div>
  );
}
