import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Gauge,
  History,
  ImagePlus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DIAGRAM_TYPES,
  REPLACEMENT_MAPPING_OPTIONS,
  THUMBNAIL_FALLBACK_RULES,
  type VesselSectionMapDefinition,
} from "./registry";
import {
  alertTitleFor,
  equipmentNameFor,
  statusText,
  workOrderTitleFor,
  type VesselIntelligenceAlertRecord,
  type EquipmentRecord,
  type RegistryDiagramRecord,
  type VesselIntelligenceWorkOrderRecord,
} from "./data";

type BuildPath = (mode: string) => string;

export function MetricPanel({
  label,
  value,
  icon: Icon,
  note,
  testId,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  note: string;
  testId: string;
}) {
  return (
    <div className="rounded-md border p-4" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function RowLink({
  href,
  title,
  meta,
  badge,
  testId,
}: {
  href: string;
  title: string;
  meta: string;
  badge?: string | undefined;
  testId: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
      data-testid={testId}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {badge && <Badge variant="outline">{badge}</Badge>}
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </span>
    </Link>
  );
}

export function DiagramRegistryPanel({
  selectedVesselId,
  buildPath,
  diagrams,
  canManageDiagrams,
}: {
  selectedVesselId: string;
  buildPath: BuildPath;
  diagrams: RegistryDiagramRecord[];
  canManageDiagrams: boolean;
}) {
  const thumbnailPath = selectedVesselId
    ? `/vessel-intelligence/${selectedVesselId}/thumbnails`
    : "/vessel-intelligence";

  return (
    <div className="rounded-md border p-4" data-testid="diagram-registry-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Replaceable Diagram Registry</h2>
          <p className="text-sm text-muted-foreground">
            Versioned diagram types and map behavior from the design package.
          </p>
        </div>
        <ImagePlus className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 space-y-2">
        {(diagrams.length ? diagrams : DIAGRAM_TYPES).map((diagram) => (
          <div
            key={"id" in diagram ? diagram.id : diagram.key}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <div className="font-medium">{"title" in diagram ? diagram.title : diagram.label}</div>
            <div className="text-xs text-muted-foreground">
              {"status" in diagram ? statusText(diagram.status) : diagram.defaultFor}
            </div>
          </div>
        ))}
      </div>
      {canManageDiagrams && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild data-testid="button-diagram-versions">
            <Link href={buildPath("diagrams")}>
              <History className="mr-2 h-4 w-4" />
              Versions
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="button-thumbnail-manager">
            <Link href={thumbnailPath}>
              <Settings className="mr-2 h-4 w-4" />
              Thumbnails
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export function EquipmentMappingPanel({
  selectedVesselId,
  vesselEquipment,
  sectionMap,
  buildPath,
}: {
  selectedVesselId: string;
  vesselEquipment: EquipmentRecord[];
  sectionMap: VesselSectionMapDefinition;
  buildPath: BuildPath;
}) {
  const mappedEquipment = sectionMap.sections.flatMap((section) =>
    section.equipment.map((equipmentName) => ({
      equipmentName,
      sectionKey: section.sectionKey,
      sectionName: section.name,
    }))
  );

  return (
    <div className="rounded-md border p-4" data-testid="equipment-mapping-panel">
      <h2 className="text-base font-semibold">Equipment Assignments</h2>
      <p className="text-sm text-muted-foreground">
        Registry assignments are loaded from the active section map and matched against live
        equipment by name or asset code.
      </p>
      <div className="mt-3 space-y-2">
        {mappedEquipment.map((seed) => {
          const linked = vesselEquipment.find((item) => {
            const liveName = equipmentNameFor(item).toLowerCase();
            return (
              liveName === seed.equipmentName.toLowerCase() ||
              item.assetCode === seed.equipmentName ||
              item.tagNumber === seed.equipmentName
            );
          });
          const href =
            selectedVesselId && linked?.id
              ? `/vessel-intelligence/${selectedVesselId}/equipment/${linked.id}`
              : buildPath("sections");
          return (
            <RowLink
              key={`${seed.sectionKey}-${seed.equipmentName}`}
              href={href}
              title={seed.equipmentName}
              meta={seed.sectionName}
              badge={linked ? "Live" : "Registry"}
              testId={`equipment-map-${seed.sectionKey}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function WorkOrdersPanel({
  selectedVesselId,
  vesselWorkOrders,
  buildPath,
}: {
  selectedVesselId: string;
  vesselWorkOrders: VesselIntelligenceWorkOrderRecord[];
  buildPath: BuildPath;
}) {
  return (
    <div className="rounded-md border p-4" data-testid="maintenance-panel">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Vessel-linked Work Orders</h2>
      </div>
      {vesselWorkOrders.length === 0 ? (
        <EmptyState message="No linked work orders returned by /api/work-orders." />
      ) : (
        <div className="space-y-2">
          {vesselWorkOrders.slice(0, 5).map((workOrder) => {
            const href =
              selectedVesselId && workOrder.id
                ? `/vessel-intelligence/${selectedVesselId}/maintenance/${workOrder.id}`
                : buildPath("maintenance");
            return (
              <RowLink
                key={workOrder.id ?? workOrderTitleFor(workOrder)}
                href={href}
                title={workOrderTitleFor(workOrder)}
                meta={statusText(workOrder.priority)}
                badge={workOrder.status}
                testId="work-order-row"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AlertsPanel({
  vesselAlerts,
  buildPath,
}: {
  vesselAlerts: VesselIntelligenceAlertRecord[];
  buildPath: BuildPath;
}) {
  return (
    <div className="rounded-md border p-4" data-testid="alerts-panel">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Technical Alerts</h2>
      </div>
      {vesselAlerts.length === 0 ? (
        <EmptyState message="No active vessel alerts returned by /api/alerts." />
      ) : (
        <div className="space-y-2">
          {vesselAlerts.slice(0, 5).map((alert) => (
            <RowLink
              key={alert.id ?? alertTitleFor(alert)}
              href={buildPath("alerts")}
              title={alertTitleFor(alert)}
              meta={statusText(alert.status)}
              badge={alert.severity}
              testId="alert-row"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReportsPanel({
  pdmUnavailable,
  buildPath,
  canManageRegistry,
}: {
  pdmUnavailable: boolean;
  buildPath: BuildPath;
  canManageRegistry: boolean;
}) {
  return (
    <div className="rounded-md border p-4" data-testid="reports-and-performance-panel">
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Performance And Reports</h2>
      </div>
      <div className="space-y-2">
        <RowLink
          href={buildPath("performance")}
          title="Performance analytics"
          meta={pdmUnavailable ? "PdM dashboard unavailable" : "Backed by /api/pdm/dashboard"}
          badge="Live"
          testId="performance-link"
        />
        <RowLink
          href={buildPath("reports")}
          title="Vessel reports"
          meta="Uses existing report/export surfaces"
          badge="Reports"
          testId="reports-link"
        />
        {canManageRegistry && (
          <RowLink
            href={buildPath("settings")}
            title="Registry settings"
            meta="Diagram and thumbnail administration"
            badge="Admin"
            testId="settings-link"
          />
        )}
      </div>
    </div>
  );
}

export function RegistryAdministrationPanels() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-md border p-4" data-testid="diagram-replacement-options">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Replacement Mapping Behavior</h2>
        </div>
        <div className="space-y-2">
          {REPLACEMENT_MAPPING_OPTIONS.map((option, index) => (
            <div key={option} className="flex gap-3 rounded-md border px-3 py-2 text-sm">
              <Badge variant="outline">{index + 1}</Badge>
              <span>{option}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border p-4" data-testid="thumbnail-fallback-panel">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Thumbnail Fallbacks</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Section</p>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              {THUMBNAIL_FALLBACK_RULES.section.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-sm font-medium">Equipment</p>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              {THUMBNAIL_FALLBACK_RULES.equipment.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
