import type { MobileReadinessScreenMarker } from "../../client/src/features/mobile-readiness/mobile-readiness-route-contract";

export const MOBILE_READINESS_VISUAL_COMPARISON_ROOT = "/private/tmp/arus-visual-comparison";

export const MOBILE_READINESS_VISUAL_VIEWPORT = { width: 390, height: 844 } as const;
export const MOBILE_READINESS_VISUAL_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  MOBILE_READINESS_VISUAL_VIEWPORT,
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
] as const;

export interface MobileReadinessVisualFidelityCase {
  id: string;
  boardGroup: string;
  route: string;
  screenMarker: MobileReadinessScreenMarker;
  referenceFrame: string;
  referenceArtifact: string;
}

const pngReference = "docs/design/vessel-intelligence-v2/png-reference/previews";

export const mobileReadinessVisualFidelityCases: readonly MobileReadinessVisualFidelityCase[] = [
  {
    id: "today-queue",
    boardGroup: "Today queues",
    route: "/",
    screenMarker: "command",
    referenceFrame: "mobile/10_mobile_offline_stale_data_state.svg",
    referenceArtifact: `${pngReference}/mobile__10_mobile_offline_stale_data_state_preview.png`,
  },
  {
    id: "fleet",
    boardGroup: "Fleet",
    route: "/fleet",
    screenMarker: "fleet",
    referenceFrame: "desktop/01_desktop_fleet_triage_overview.svg",
    referenceArtifact: `${pngReference}/desktop__01_desktop_fleet_triage_overview_preview.png`,
  },
  {
    id: "vessel-overview",
    boardGroup: "Vessel overview",
    route: "/vessel-intelligence/mv-atlas/overview",
    screenMarker: "vessel-detail",
    referenceFrame: "mobile/01_mobile_vessel_intelligence_overview.svg",
    referenceArtifact: `${pngReference}/mobile__01_mobile_vessel_intelligence_overview_preview.png`,
  },
  {
    id: "vessel-diagram",
    boardGroup: "Vessel diagram",
    route: "/vessel-intelligence/mv-atlas/diagrams",
    screenMarker: "vessel-diagram",
    referenceFrame: "mobile/02_mobile_section_map_accurate_traced_sections.svg",
    referenceArtifact: `${pngReference}/mobile__02_mobile_section_map_accurate_traced_sections_preview.png`,
  },
  {
    id: "pdm-risk-queue",
    boardGroup: "PdM risk queue",
    route: "/pdm-platform",
    screenMarker: "pdm-queue",
    referenceFrame: "mobile/04_mobile_maintenance_overview.svg",
    referenceArtifact: `${pngReference}/mobile__04_mobile_maintenance_overview_preview.png`,
  },
  // NOTE: "asset-case" (/pdm/equipment/:id) and "telemetry-advanced"
  // (/pdm/equipment/:id/telemetry) were removed here when those screens were
  // converted from static Figma-fidelity boards into the live, data-driven
  // PdmEquipmentDetail page. They are no longer pixel-pinned to a reference
  // board; their behaviour is covered by tests/playwright/journeys/
  // pdm-equipment-detail.spec.ts instead. The pdm-queue board stays static.
  {
    id: "work-queue",
    boardGroup: "Work queue",
    route: "/work-orders",
    screenMarker: "work-queue",
    referenceFrame: "mobile/04_mobile_maintenance_overview.svg",
    referenceArtifact: `${pngReference}/mobile__04_mobile_maintenance_overview_preview.png`,
  },
  {
    id: "technician-execution",
    boardGroup: "Technician execution",
    route: "/work-orders/so-4481",
    screenMarker: "work-execution",
    referenceFrame: "mobile/05_mobile_work_order_detail_evidence.svg",
    referenceArtifact: `${pngReference}/mobile__05_mobile_work_order_detail_evidence_preview.png`,
  },
  {
    id: "logs",
    boardGroup: "Logs",
    route: "/logs",
    screenMarker: "logs",
    referenceFrame: "mobile/08_mobile_reports.svg",
    referenceArtifact: `${pngReference}/mobile__08_mobile_reports_preview.png`,
  },
  {
    id: "crew",
    boardGroup: "Crew",
    route: "/crew-management",
    screenMarker: "crew",
    referenceFrame: "mobile/07_mobile_expert_cases.svg",
    referenceArtifact: `${pngReference}/mobile__07_mobile_expert_cases_preview.png`,
  },
  {
    id: "inventory",
    boardGroup: "Inventory",
    route: "/logistics",
    screenMarker: "inventory",
    referenceFrame: "desktop/14_desktop_thumbnail_managers.svg",
    referenceArtifact: `${pngReference}/desktop__14_desktop_thumbnail_managers_preview.png`,
  },
  {
    id: "settings",
    boardGroup: "Settings",
    route: "/system",
    screenMarker: "settings",
    referenceFrame: "mobile/09_mobile_settings_replace_thumbnails.svg",
    referenceArtifact: `${pngReference}/mobile__09_mobile_settings_replace_thumbnails_preview.png`,
  },
];
