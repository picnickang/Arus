import type { ReactNode } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  ImageOff,
  MapPinned,
  QrCode,
  RadioTower,
  ShieldCheck,
  Ship,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VesselSectionOverlay } from "./SectionedVesselMap";
import type { FleetMapMarker, FleetTriageSeverity, FleetTriageVessel } from "./fleet-triage-types";
import type { VesselSectionMapDefinition } from "./registry";

export function severityClasses(severity: FleetTriageSeverity): string {
  switch (severity) {
    case "critical":
      return "border-rose-400/40 bg-rose-500/10 text-rose-200";
    case "warning":
      return "border-amber-400/40 bg-amber-500/10 text-amber-200";
    case "missing":
      return "border-slate-400/40 bg-slate-500/10 text-slate-200";
    case "healthy":
      return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  }
}

function severityDot(severity: FleetTriageSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-rose-400";
    case "warning":
      return "bg-amber-300";
    case "missing":
      return "bg-slate-400";
    case "healthy":
      return "bg-emerald-300";
  }
}

function formatHealth(value: number | null): string {
  return value === null ? "No data" : String(value);
}

function statusLabel(value: string): string {
  if (value === "not_uploaded") {
    return "Not uploaded";
  }
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function FleetTriagePanel({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-md border border-sky-900/70 bg-[#0a1d31] p-4 shadow-[0_0_0_1px_rgba(14,165,233,0.04)] ${className}`}
      data-testid={testId}
    >
      {children}
    </section>
  );
}

export function FleetPriorityList({
  vessels,
  onOpenVessel,
}: {
  vessels: FleetTriageVessel[];
  onOpenVessel: (href: string) => void;
}) {
  return (
    <FleetTriagePanel testId="fleet-triage-list" className="lg:row-span-2">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">Fleet Technical Triage</h2>
          <p className="mt-1 text-xs text-slate-400">
            Ranked from live alerts, work orders, equipment, and registry feeds.
          </p>
        </div>
        <Badge className="border-sky-400/40 bg-sky-500/10 text-sky-100" variant="outline">
          {vessels.length} vessels
        </Badge>
      </div>

      {vessels.length === 0 ? (
        <div className="rounded-md border border-dashed border-sky-900/80 p-6 text-sm text-slate-300">
          No vessels available for fleet triage.
        </div>
      ) : (
        <div className="space-y-2">
          {vessels.map((vessel, index) => (
            <button
              key={vessel.vesselId}
              type="button"
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-sky-900/70 bg-[#08192a] p-3 text-left transition-colors hover:border-sky-500/50 hover:bg-sky-500/10"
              onClick={() => onOpenVessel(vessel.actionHref)}
              data-testid={`fleet-triage-row-${vessel.vesselId}`}
            >
              <span className="grid h-9 w-9 place-items-center rounded-md bg-[#102a43] text-xs font-semibold text-sky-100">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${severityDot(vessel.status)}`} />
                  <span className="truncate text-sm font-semibold text-slate-50">
                    {vessel.vesselName}
                  </span>
                  <Badge className={severityClasses(vessel.status)} variant="outline">
                    {vessel.status}
                  </Badge>
                </span>
                <span className="mt-1 block truncate text-xs text-slate-300">
                  {vessel.topIssue}
                </span>
                <span className="mt-1 block truncate text-[11px] text-slate-500">
                  {vessel.sectionLabel} - {vessel.equipmentLabel}
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span data-testid="fleet-vessel-class">{vessel.vesselClassLabel}</span>
                  <span>{vessel.conditionLabel}</span>
                  <span>{vessel.onlineStatusLabel}</span>
                  <span data-testid="fleet-vessel-heartbeat">{vessel.lastHeartbeatLabel}</span>
                  <span>{vessel.linkedEquipment} equipment</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block text-lg font-semibold text-slate-50">
                  {formatHealth(vessel.healthScore)}
                </span>
                <span className="block text-[11px] text-slate-500">health</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </FleetTriagePanel>
  );
}

export function FleetMapStatus({
  markers,
  onOpenMarker,
}: {
  markers: FleetMapMarker[];
  onOpenMarker: (href: string) => void;
}) {
  return (
    <FleetTriagePanel testId="fleet-map-status">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">Fleet Status Plot</h2>
          <p className="mt-1 text-xs text-slate-400">
            Relative status markers derived from the fleet triage queue.
          </p>
        </div>
        <MapPinned className="h-4 w-4 text-sky-300" />
      </div>
      <div
        className="relative overflow-hidden rounded-md border border-sky-900/70 bg-[#051324]"
        data-testid="fleet-status-plot"
      >
        <svg viewBox="0 0 100 54" className="h-64 w-full" aria-hidden="true">
          <defs>
            <linearGradient id="fleet-sea" x1="0" x2="1" y1="0" y2="1">
              <stop stopColor="#08223a" offset="0%" />
              <stop stopColor="#06101f" offset="100%" />
            </linearGradient>
          </defs>
          <rect width="100" height="54" fill="url(#fleet-sea)" />
          <path
            d="M4 38 C22 30 38 41 55 31 S83 28 97 18"
            fill="none"
            stroke="#0ea5e9"
            strokeOpacity=".25"
            strokeWidth="1.1"
          />
          <path
            d="M10 18 C25 14 34 22 47 18 S75 10 91 15"
            fill="none"
            stroke="#22c55e"
            strokeOpacity=".18"
            strokeWidth=".9"
          />
          {markers.map((marker) => (
            <g key={marker.vesselId}>
              <circle
                cx={marker.x}
                cy={marker.y}
                r="4.8"
                className={severityDot(marker.status)}
                opacity=".2"
              />
              <circle cx={marker.x} cy={marker.y} r="2.1" className={severityDot(marker.status)} />
            </g>
          ))}
        </svg>
        <div className="absolute inset-0">
          {markers.map((marker) => (
            <button
              key={marker.vesselId}
              type="button"
              className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-300"
              style={{ left: `${marker.x}%`, top: `${(marker.y / 54) * 100}%` }}
              aria-label={`Open ${marker.vesselName}`}
              onClick={() => onOpenMarker(marker.href)}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
        {[
          ["healthy", "Operational"],
          ["warning", "Watch"],
          ["critical", "Critical"],
          ["missing", "Data gap"],
        ].map(([severity, label]) => (
          <span key={severity} className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${severityDot(severity as FleetTriageSeverity)}`}
            />
            {label}
          </span>
        ))}
      </div>
    </FleetTriagePanel>
  );
}

export function FleetVesselDiagramPreview({
  vesselName,
  diagramTitle,
  mediaUrl,
  sectionMap,
  sideElevationStatus,
  onOpenDiagram,
  onReplaceSideElevation,
}: {
  vesselName: string;
  diagramTitle?: string | null | undefined;
  mediaUrl?: string | undefined;
  sectionMap?: VesselSectionMapDefinition | null;
  sideElevationStatus: string;
  onOpenDiagram: () => void;
  onReplaceSideElevation: () => void;
}) {
  return (
    <FleetTriagePanel testId="fleet-vessel-diagram-preview" className="lg:col-span-2">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">Vessel Diagram</h2>
          <p className="mt-1 text-xs text-slate-400">
            {diagramTitle || `${vesselName} active schematic`}
          </p>
          <Badge
            className="mt-2 border-sky-400/40 bg-sky-500/10 text-sky-100"
            variant="outline"
            data-testid="fleet-side-elevation-status"
          >
            Side elevation: {statusLabel(sideElevationStatus)}
          </Badge>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-sky-900/70 bg-[#0a2238] text-slate-100 hover:bg-sky-500/15"
            onClick={onReplaceSideElevation}
            data-testid="button-replace-side-elevation"
          >
            <RadioTower className="mr-2 h-3.5 w-3.5" />
            Replace side elevation
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-sky-900/70 bg-[#0a2238] text-slate-100 hover:bg-sky-500/15"
            onClick={onOpenDiagram}
            data-testid="button-open-vessel-diagram"
          >
            Open twin
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {sectionMap ? (
        <div className="overflow-hidden rounded-md border border-sky-900/70 bg-[#051324] p-2">
          <VesselSectionOverlay
            sectionMap={sectionMap}
            baseImageUrl={mediaUrl}
            testId="fleet-vessel-section-overlay"
            baseLayerTestId="fleet-vessel-diagram-image"
            className="h-auto w-full"
          />
        </div>
      ) : mediaUrl ? (
        <div className="overflow-hidden rounded-md border border-sky-900/70 bg-[#051324] p-2">
          <img
            src={mediaUrl}
            alt={`${vesselName} active vessel diagram`}
            className="h-64 w-full object-contain"
            data-testid="fleet-vessel-diagram-image"
          />
        </div>
      ) : (
        <div
          className="flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-sky-900/80 bg-[#08192a] p-6 text-center text-sm text-slate-300"
          data-testid="fleet-vessel-diagram-empty"
        >
          <ImageOff className="mb-3 h-8 w-8 text-slate-500" />
          No active vessel diagram is published for this vessel.
        </div>
      )}
    </FleetTriagePanel>
  );
}

export function FleetRegistryAccessPanel({
  vesselCount,
  equipmentCount,
  priorityVesselId,
  sideElevationStatus,
  onOpen,
}: {
  vesselCount: number;
  equipmentCount: number;
  priorityVesselId: string;
  sideElevationStatus: string;
  onOpen: (href: string) => void;
}) {
  const diagramHref = priorityVesselId
    ? `/vessel-intelligence/${priorityVesselId}/diagrams`
    : "/vessel-intelligence";
  const links: Array<{
    label: string;
    description: string;
    href: string;
    testId: string;
    icon: LucideIcon;
  }> = [
    {
      label: "Vessel Registry",
      description: `${vesselCount} vessels. Add, import, edit, export, reset, and archive vessel records.`,
      href: "/vessel-management",
      testId: "button-open-vessel-registry",
      icon: Ship,
    },
    {
      label: "Equipment Registry",
      description: `${equipmentCount} equipment records. Search, filter, edit, sensor setup, and lifecycle actions.`,
      href: "/equipment",
      testId: "button-open-equipment-registry",
      icon: Wrench,
    },
    {
      label: "Certificates",
      description: "Open vessel and equipment certificate records.",
      href: "/certificates",
      testId: "button-open-certificates",
      icon: ShieldCheck,
    },
    {
      label: "Scan Equipment",
      description: "Use QR or asset tags to open equipment context.",
      href: "/equipment-scan",
      testId: "button-open-equipment-scan",
      icon: QrCode,
    },
    {
      label: "Diagram Registry",
      description: `Side elevation is ${statusLabel(sideElevationStatus).toLowerCase()}. Replace via the versioned registry.`,
      href: diagramHref,
      testId: "button-open-diagram-registry",
      icon: RadioTower,
    },
  ];

  return (
    <FleetTriagePanel testId="fleet-registry-access" className="lg:col-span-3">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">Registry Access</h2>
          <p className="mt-1 text-xs text-slate-400">
            Full management workflows remain in the dedicated Fleet registry pages.
          </p>
        </div>
        <Badge className="border-sky-400/40 bg-sky-500/10 text-sky-100" variant="outline">
          No duplicate CRUD
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.href}
              type="button"
              className="rounded-md border border-sky-900/70 bg-[#08192a] p-3 text-left transition-colors hover:border-sky-500/50 hover:bg-sky-500/10"
              onClick={() => onOpen(link.href)}
              data-testid={link.testId}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-50">
                <Icon className="h-4 w-4 text-sky-300" />
                {link.label}
              </span>
              <span className="mt-2 block text-xs leading-5 text-slate-400">
                {link.description}
              </span>
            </button>
          );
        })}
      </div>
    </FleetTriagePanel>
  );
}

export function FleetActionBoard({
  rows,
  onOpenRow,
}: {
  rows: FleetTriageVessel[];
  onOpenRow: (href: string) => void;
}) {
  return (
    <FleetTriagePanel testId="fleet-action-board" className="lg:col-span-3">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">Fleet Action Board</h2>
          <p className="mt-1 text-xs text-slate-400">
            Every row opens an existing Vessel Intelligence drill-down.
          </p>
        </div>
        <ClipboardCheck className="h-4 w-4 text-sky-300" />
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-sky-900/80 p-6 text-sm text-slate-300">
          No fleet action rows are open from the current live inputs.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Vessel</th>
                <th className="pb-2 font-medium">Issue</th>
                <th className="pb-2 font-medium">Owner</th>
                <th className="pb-2 font-medium">Due</th>
                <th className="pb-2 font-medium">Target</th>
                <th className="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-900/60">
              {rows.map((row) => (
                <tr key={row.vesselId} data-testid={`fleet-action-row-${row.vesselId}`}>
                  <td className="py-3 pr-3 font-medium text-slate-100">{row.vesselName}</td>
                  <td className="py-3 pr-3 text-slate-300">{row.topIssue}</td>
                  <td className="py-3 pr-3 text-slate-400">{row.ownerLabel}</td>
                  <td className="py-3 pr-3 text-slate-400">{row.dueLabel}</td>
                  <td className="py-3 pr-3 text-slate-400">{row.sectionLabel}</td>
                  <td className="py-3 text-right">
                    <Button
                      size="sm"
                      className="bg-sky-500 text-white hover:bg-sky-400"
                      onClick={() => onOpenRow(row.actionHref)}
                      data-testid={`button-open-vessel-action-${row.vesselId}`}
                    >
                      {row.actionLabel}
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FleetTriagePanel>
  );
}
