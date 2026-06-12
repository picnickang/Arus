import type { LucideIcon } from "lucide-react";
import type { MobileReadinessAssetId } from "./mobile-readiness-assets";

export type MobileRole = "admin" | "captain" | "crew" | "chief_engineer" | "logistics";

export type ReadinessTone = "critical" | "high" | "medium" | "normal" | "good" | "offline" | "info";

export interface MobileNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export type MobileNavVariant = "roleToday" | "fleetOps" | "machineryOps" | "technician" | "crewOps";

export interface SummaryMetric {
  id: string;
  label: string;
  value: string;
  tone: ReadinessTone;
}

export interface QueueItem {
  id: string;
  title: string;
  category: string;
  reason: string;
  detail: string;
  severity: ReadinessTone;
  owner: string;
  action: string;
  icon: LucideIcon;
  href: string;
}

export interface TodayScreen {
  roleLabel: string;
  vesselName: string;
  queueLabel: string;
  itemCount: number;
  items: QueueItem[];
}

export interface FleetVesselCard {
  id: string;
  name: string;
  route: string;
  operationalState: string;
  readiness: number;
  pdmRiskScore: number;
  riskTone: ReadinessTone;
  nextAction: string;
  thumbnailTone: "red" | "orange" | "blue";
  assetId: MobileReadinessAssetId;
  kpis: SummaryMetric[];
}

export interface FleetScreen {
  summary: SummaryMetric[];
  vessels: FleetVesselCard[];
  vesselDetail: {
    name: string;
    subtitle: string;
    readiness: number;
    topPriorities: QueueItem[];
    tiles: SummaryMetric[];
    diagramModes: string[];
    diagramAssetId: MobileReadinessAssetId;
    selectedZone: {
      name: string;
      status: ReadinessTone;
      location: string;
      related: string;
      actions: string[];
    };
  };
}

export interface PdmRiskCard {
  equipmentId: string;
  asset: string;
  subtitle: string;
  riskState: string;
  riskScore: number | null;
  signal: string;
  action: string;
  sourceHealth: string;
  tone: ReadinessTone;
  icon: LucideIcon;
}

export interface PdmScreen {
  summary: SummaryMetric[];
  riskQueue: PdmRiskCard[];
  assetCase: {
    asset: string;
    riskScore: number;
    trend: string;
    status: string;
    sourceHealth: string;
    dataFreshness: string;
    evidenceSections: Array<{
      title: string;
      body: string;
    }>;
  };
  telemetryAdvanced: {
    trust: string;
    confidence: number;
    lastUpdate: string;
    rawReadingsAvailable: boolean;
    sensorHealthCount: number;
    chartAssetId: MobileReadinessAssetId;
  };
}

export interface WorkScreen {
  filters: SummaryMetric[];
  stageChips: SummaryMetric[];
  queue: QueueItem[];
  execution: {
    orderNumber: string;
    vesselName: string;
    assetId: MobileReadinessAssetId;
    title: string;
    description: string;
    priority: string;
    due: string;
    syncState: string;
    technician: string;
    checklistProgress: string;
    percentComplete: number;
    checklist: Array<{
      label: string;
      state: "done" | "open";
      telemetry?: string;
    }>;
    requiredPhotos: number;
    partsUsed: string;
    labor: string;
    photoAssetIds: MobileReadinessAssetId[];
    offlineDraftAction: string;
    primaryAction: string;
    notes: string;
  };
}

export interface LogsScreen {
  requiredBanner: string;
  tabs: string[];
  autofillTrust: SummaryMetric[];
  requiredCards: Array<{
    title: string;
    subtitle: string;
    status: string;
  }>;
  complianceHistory: SummaryMetric[];
  complianceRows: Array<{
    date: string;
    status: string;
    signer: string;
  }>;
}

export interface CrewScreen {
  vesselName: string;
  readiness: SummaryMetric[];
  blockers: QueueItem[];
  currentCrew: Array<{
    name: string;
    rank: string;
    status: string;
    docs: string;
    avatarAssetId: MobileReadinessAssetId;
  }>;
  formerCrew: Array<{
    name: string;
    rank: string;
    status: string;
    date: string;
    avatarAssetId: MobileReadinessAssetId;
  }>;
}

export interface InventoryScreen {
  actionRequired: SummaryMetric[];
  rows: Array<{
    partNumber: string;
    name: string;
    location: string;
    onHand: number;
    available: number;
    reorderStatus: string;
    tone: ReadinessTone;
  }>;
  linkedWorkOrders: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  logisticsTasks: Array<{
    id: string;
    title: string;
    eta: string;
  }>;
}

export interface SettingsScreen {
  profile: {
    name: string;
    role: string;
    email: string;
    avatarAssetId: MobileReadinessAssetId;
  };
  items: Array<{
    label: string;
    detail?: string;
    icon: LucideIcon;
    tone?: ReadinessTone;
  }>;
}

export interface MobileReadinessScreens {
  nav: MobileNavItem[];
  today: TodayScreen;
  fleet: FleetScreen;
  pdm: PdmScreen;
  work: WorkScreen;
  logs: LogsScreen;
  crew: CrewScreen;
  inventory: InventoryScreen;
  settings: SettingsScreen;
}
