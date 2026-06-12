import {
  Anchor,
  AlertTriangle,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  Cog,
  FileCheck2,
  FileText,
  Folder,
  Gauge,
  Home,
  LifeBuoy,
  Package,
  RadioTower,
  Settings,
  Shield,
  Ship,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { MobileReadinessAssetId } from "./mobile-readiness-assets";

export type MobileRole = "admin" | "captain" | "crew" | "chief_engineer" | "logistics";

export const MOBILE_READINESS_DECISION_PATTERN =
  "Status -> Reason -> Action -> Evidence -> Assisted Draft";

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

const roleAliases: Record<string, MobileRole> = {
  admin: "admin",
  super_admin: "admin",
  company_admin: "admin",
  captain: "captain",
  deck_officer: "captain",
  crew: "crew",
  crew_member: "crew",
  technician: "crew",
  maintenance_technician: "crew",
  viewer: "crew",
  chief_engineer: "chief_engineer",
  maintenance: "chief_engineer",
  maintenance_planner: "chief_engineer",
  safety_officer: "captain",
  logistics: "logistics",
  logistics_user: "logistics",
  procurement_user: "logistics",
};

export function normalizeMobileRole(role: string | null | undefined): MobileRole {
  return roleAliases[(role ?? "").toLowerCase()] ?? "admin";
}

export function severityRank(tone: ReadinessTone): number {
  switch (tone) {
    case "critical":
      return 60;
    case "high":
      return 50;
    case "medium":
      return 40;
    case "offline":
      return 30;
    case "normal":
      return 20;
    case "info":
      return 10;
    case "good":
      return 0;
    default:
      return 0;
  }
}

export function buildMobileReadinessNavigation(
  roleInput: string | null | undefined
): MobileNavItem[] {
  const role = normalizeMobileRole(roleInput);
  if (role === "captain") {
    return [
      { id: "bridge", label: "Bridge", href: "/", icon: Anchor },
      { id: "logs", label: "Logs", href: "/logs", icon: BookOpen },
      { id: "crew", label: "Crew", href: "/crew-management", icon: Users },
      { id: "maintenance", label: "Maintenance", href: "/pdm-platform", icon: Wrench },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  if (role === "crew") {
    return [
      { id: "my-tasks", label: "My Tasks", href: "/", icon: ClipboardCheck },
      { id: "logs", label: "Logs", href: "/logs", icon: BookOpen },
      { id: "safety", label: "Safety", href: "/logs/compliance", icon: Shield },
      { id: "documents", label: "Documents", href: "/knowledge-base", icon: Folder },
      { id: "settings", label: "Settings", href: "/profile", icon: Settings },
    ];
  }
  if (role === "chief_engineer") {
    return [
      { id: "today", label: "Today", href: "/", icon: CalendarCheck },
      { id: "machinery", label: "Machinery", href: "/pdm-platform", icon: Wrench },
      { id: "work", label: "Work", href: "/work-orders", icon: ClipboardList },
      { id: "logs", label: "Logs", href: "/logs", icon: FileText },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  if (role === "logistics") {
    return [
      { id: "home", label: "Home", href: "/", icon: Home },
      { id: "crew", label: "Crew", href: "/crew-management", icon: Users },
      { id: "inventory", label: "Inventory", href: "/logistics", icon: Package },
      { id: "work", label: "Work", href: "/work-orders", icon: BriefcaseBusiness },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  return [
    { id: "command", label: "Command", href: "/", icon: Home },
    { id: "vessels", label: "Vessels", href: "/fleet", icon: Ship },
    { id: "tasks", label: "Tasks", href: "/work-orders", icon: ClipboardCheck },
    { id: "reports", label: "Reports", href: "/logs/compliance", icon: FileCheck2 },
    { id: "settings", label: "Settings", href: "/system", icon: Settings },
  ];
}

export function buildMobileReadinessNavigationForVariant(
  variant: MobileNavVariant,
  roleInput: string | null | undefined
): MobileNavItem[] {
  if (variant === "fleetOps") {
    return [
      { id: "fleet", label: "Fleet", href: "/fleet", icon: Ship },
      { id: "work", label: "Work", href: "/work-orders", icon: ClipboardList },
      { id: "alerts", label: "Alerts", href: "/alerts", icon: Bell },
      { id: "crew", label: "Crew", href: "/crew-management", icon: Users },
      { id: "inventory", label: "Inventory", href: "/logistics", icon: Package },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  if (variant === "machineryOps") {
    return [
      { id: "today", label: "Today", href: "/", icon: CalendarCheck },
      { id: "machinery", label: "Machinery", href: "/pdm-platform", icon: Wrench },
      { id: "work", label: "Work", href: "/work-orders", icon: ClipboardList },
      { id: "logs", label: "Logs", href: "/logs", icon: FileText },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  if (variant === "technician") {
    return [
      { id: "today", label: "Today", href: "/", icon: CalendarCheck },
      { id: "work", label: "Work", href: "/work-orders", icon: ClipboardList },
      { id: "logs", label: "Logs", href: "/logs", icon: FileText },
      { id: "profile", label: "Profile", href: "/profile", icon: Users },
    ];
  }
  if (variant === "crewOps") {
    return [
      { id: "home", label: "Home", href: "/", icon: Home },
      { id: "crew", label: "Crew", href: "/crew-management", icon: Users },
      { id: "inventory", label: "Inventory", href: "/logistics", icon: Package },
      { id: "work", label: "Work", href: "/work-orders", icon: BriefcaseBusiness },
      { id: "compliance", label: "Compliance", href: "/logs/compliance", icon: Shield },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  return buildMobileReadinessNavigation(roleInput);
}

function sortQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

const adminQueue: QueueItem[] = [
  {
    id: "engine-room-fire",
    title: "Engine room fire alarm",
    category: "Alarm",
    reason: "Alarm - 09:36",
    detail: "Deck 2 - Engine Room",
    severity: "critical",
    owner: "Chief Engineer",
    action: "Acknowledge after inspection",
    icon: Bell,
    href: "/alerts",
  },
  {
    id: "port-generator-vibration",
    title: "Port Generator vibration",
    category: "PdM Risk",
    reason: "PdM Risk - 08:48",
    detail: "GE Stamford Generator 2",
    severity: "high",
    owner: "2/E Electrical",
    action: "Inspect within 48h",
    icon: RadioTower,
    href: "/pdm-platform",
  },
  {
    id: "chief-engineer-cert",
    title: "Chief Engineer certificate expired",
    category: "Crew Blocker",
    reason: "Crew Blocker - Since 04 May",
    detail: "Certificate of Competency",
    severity: "high",
    owner: "Crewing",
    action: "Assign relief or renew certificate",
    icon: Users,
    href: "/crew-management",
  },
  {
    id: "fuel-filter-unavailable",
    title: "Fuel filter unavailable",
    category: "Inventory Blocker",
    reason: "Inventory Blocker - Since 06 May",
    detail: "Part No. 100FG-30",
    severity: "medium",
    owner: "Stores",
    action: "Reserve or reorder",
    icon: Package,
    href: "/logistics",
  },
  {
    id: "orb-overdue",
    title: "Oil Record Book overdue",
    category: "Log",
    reason: "Log - Due 08 May",
    detail: "Engine Room - ORB",
    severity: "medium",
    owner: "Chief Engineer",
    action: "Review and sign",
    icon: FileText,
    href: "/logs",
  },
  {
    id: "sync-pending",
    title: "Offline - sync pending",
    category: "Sync",
    reason: "Last synced 2 days ago",
    detail: "15 changes to upload",
    severity: "normal",
    owner: "System Admin",
    action: "Open offline outbox",
    icon: Cloud,
    href: "/offline-outbox",
  },
  {
    id: "ism-task-overdue",
    title: "ISM task overdue",
    category: "Safety",
    reason: "Safety - Due 05 May",
    detail: "Monthly Safety Review",
    severity: "medium",
    owner: "Captain",
    action: "Complete safety review",
    icon: Shield,
    href: "/logs/compliance",
  },
];

const crewQueue: QueueItem[] = [
  {
    id: "clean-bilge",
    title: "Clean bilge holding tank",
    category: "Task",
    reason: "Assigned by Chief Engineer",
    detail: "Due today 12:00",
    severity: "medium",
    owner: "You",
    action: "Open checklist",
    icon: ClipboardCheck,
    href: "/my-tasks",
  },
  {
    id: "engine-log-draft",
    title: "Daily Engine Log (Draft)",
    category: "Log",
    reason: "Your draft in progress",
    detail: "Last edited 08:30",
    severity: "normal",
    owner: "You",
    action: "Review autofill",
    icon: FileText,
    href: "/logs",
  },
  {
    id: "safety-instruction",
    title: "Safety instruction",
    category: "Safety",
    reason: "Enclosed space entry refresher",
    detail: "Read and acknowledge",
    severity: "medium",
    owner: "You",
    action: "Acknowledge",
    icon: Shield,
    href: "/logs/compliance",
  },
  {
    id: "medical-certificate",
    title: "Medical certificate expiring",
    category: "Document",
    reason: "Your medical certificate",
    detail: "Expires 28 May 2025",
    severity: "medium",
    owner: "You",
    action: "Upload renewal",
    icon: FileCheck2,
    href: "/profile",
  },
  {
    id: "offline-draft",
    title: "Offline draft",
    category: "Sync",
    reason: "Engine Log - not synced",
    detail: "Will sync when online",
    severity: "normal",
    owner: "You",
    action: "Open draft",
    icon: Cloud,
    href: "/offline-outbox",
  },
];

function buildTodayScreen(role: MobileRole): TodayScreen {
  if (role === "crew") {
    const items = crewQueue;
    return {
      roleLabel: "Crew",
      vesselName: "MV Atlas",
      queueLabel: "My Queue",
      itemCount: items.length,
      items,
    };
  }
  if (role === "captain") {
    const items: QueueItem[] = [
      {
        id: "vessel-ready",
        title: "Vessel readiness - Good",
        category: "Readiness",
        reason: "All systems operational",
        detail: "Last check 07:15",
        severity: "normal",
        owner: "Captain",
        action: "Review readiness",
        icon: Shield,
        href: "/fleet",
      },
      {
        id: "log-signoff",
        title: "Required log sign-off",
        category: "Log",
        reason: "Oil Record Book",
        detail: "Entries to review: 2",
        severity: "medium",
        owner: "Captain",
        action: "Review and sign",
        icon: FileText,
        href: "/logs",
      },
      {
        id: "active-alert",
        title: "Active alert",
        category: "Alert",
        reason: "High temperature - No. 2 AUX Engine",
        detail: "Raised 09:22",
        severity: "high",
        owner: "Chief Engineer",
        action: "Explain risk",
        icon: Bell,
        href: "/alerts",
      },
      {
        id: "crew-ready",
        title: "Crew readiness",
        category: "Crew",
        reason: "1 certificate expiring within 30 days",
        detail: "4 drills due this week",
        severity: "medium",
        owner: "Crewing",
        action: "Open crew",
        icon: Users,
        href: "/crew-management",
      },
      {
        id: "weather-log",
        title: "Weather & condition log",
        category: "Log",
        reason: "Daily report required",
        detail: "ETA next port: 18 May 06:00",
        severity: "medium",
        owner: "Deck Officer",
        action: "Review autofill",
        icon: Cloud,
        href: "/logs",
      },
    ];
    return {
      roleLabel: "Captain",
      vesselName: "MV Atlas",
      queueLabel: "Command Queue",
      itemCount: items.length,
      items,
    };
  }
  const items = adminQueue;
  return {
    roleLabel: role === "chief_engineer" ? "Chief Engineer" : "Admin",
    vesselName: "MV Atlas",
    queueLabel: "Command Queue",
    itemCount: items.length,
    items,
  };
}

const fleetVessels: FleetVesselCard[] = [
  {
    id: "mv-atlas",
    name: "MV Atlas",
    route: "Singapore -> Rotterdam",
    operationalState: "At sea",
    readiness: 78,
    pdmRiskScore: 82,
    riskTone: "high",
    nextAction: "A/E LO purifier service overdue",
    thumbnailTone: "red",
    assetId: "vessel-atlas",
    kpis: [
      { id: "readiness", label: "Readiness", value: "78%", tone: "good" },
      { id: "alarms", label: "Alarms", value: "2", tone: "critical" },
      { id: "overdue", label: "Overdue", value: "5", tone: "high" },
      { id: "crew", label: "Crew", value: "90%", tone: "good" },
      { id: "logs", label: "Logs", value: "87%", tone: "good" },
      { id: "trust", label: "Trust", value: "96%", tone: "good" },
    ],
  },
  {
    id: "mv-borealis",
    name: "MV Borealis",
    route: "Hamburg, Germany",
    operationalState: "In port",
    readiness: 63,
    pdmRiskScore: 46,
    riskTone: "medium",
    nextAction: "Bow thruster inspection due",
    thumbnailTone: "orange",
    assetId: "vessel-borealis",
    kpis: [
      { id: "readiness", label: "Readiness", value: "63%", tone: "medium" },
      { id: "alarms", label: "Alarms", value: "1", tone: "medium" },
      { id: "overdue", label: "Overdue", value: "3", tone: "high" },
      { id: "crew", label: "Crew", value: "80%", tone: "good" },
      { id: "logs", label: "Logs", value: "72%", tone: "medium" },
      { id: "trust", label: "Trust", value: "92%", tone: "good" },
    ],
  },
  {
    id: "mv-corvus",
    name: "MV Corvus",
    route: "Dubai -> Mumbai",
    operationalState: "At sea",
    readiness: 92,
    pdmRiskScore: 18,
    riskTone: "good",
    nextAction: "No critical actions",
    thumbnailTone: "blue",
    assetId: "vessel-corvus",
    kpis: [
      { id: "readiness", label: "Readiness", value: "92%", tone: "good" },
      { id: "alarms", label: "Alarms", value: "0", tone: "good" },
      { id: "overdue", label: "Overdue", value: "0", tone: "good" },
      { id: "crew", label: "Crew", value: "95%", tone: "good" },
      { id: "logs", label: "Logs", value: "92%", tone: "good" },
      { id: "trust", label: "Trust", value: "98%", tone: "good" },
    ],
  },
];

function buildFleetScreen(): FleetScreen {
  return {
    summary: [
      { id: "vessels", label: "Vessels", value: "12", tone: "info" },
      { id: "high-risk", label: "High risk", value: "3", tone: "critical" },
      { id: "alarms", label: "Alarms", value: "5", tone: "high" },
      { id: "overdue", label: "Overdue", value: "8", tone: "medium" },
    ],
    vessels: fleetVessels,
    vesselDetail: {
      name: "MV Atlas",
      subtitle: "At sea - Singapore -> Rotterdam",
      readiness: 78,
      topPriorities: sortQueue([
        {
          id: "pump",
          title: "High pressure fuel pump",
          category: "Alarm",
          reason: "Abnormal vibration detected",
          detail: "Machinery zone",
          severity: "critical",
          owner: "Chief Engineer",
          action: "Create work order",
          icon: Bell,
          href: "/work-orders",
        },
        {
          id: "purifier",
          title: "A/E LO purifier service",
          category: "Maintenance",
          reason: "Overdue by 8 days",
          detail: "Auxiliary engine",
          severity: "high",
          owner: "2/E",
          action: "Assign technician",
          icon: Wrench,
          href: "/work-orders",
        },
        {
          id: "chief-engineer",
          title: "Chief Engineer unavailable",
          category: "Crew",
          reason: "Backfill required",
          detail: "Crew blocker",
          severity: "medium",
          owner: "Crewing",
          action: "Open crew readiness",
          icon: Users,
          href: "/crew-management",
        },
      ]),
      tiles: [
        { id: "work-orders", label: "Work orders", value: "18", tone: "high" },
        { id: "inventory", label: "Inventory blocker", value: "2", tone: "critical" },
        { id: "logs", label: "Required logs", value: "7", tone: "medium" },
        { id: "alerts", label: "Open alerts", value: "4", tone: "critical" },
      ],
      diagramModes: [
        "Side elevation",
        "Deck plan",
        "Machinery arrangement",
        "Fire safety",
        "Electrical single-line",
        "Custom",
      ],
      diagramAssetId: "diagram-side-elevation",
      selectedZone: {
        name: "Engine room",
        status: "medium",
        location: "Below main deck",
        related: "3 Alarms, 2 Logs",
        actions: ["Machinery", "Alarm", "Log", "Inspection"],
      },
    },
  };
}

function buildPdmScreen(): PdmScreen {
  return {
    summary: [
      { id: "high-risk", label: "High Risk", value: "2", tone: "critical" },
      { id: "watch", label: "Watch", value: "1", tone: "medium" },
      { id: "normal", label: "Normal", value: "1", tone: "good" },
      { id: "offline", label: "Offline", value: "0", tone: "offline" },
    ],
    riskQueue: [
      {
        equipmentId: "port-generator",
        asset: "Port Generator",
        subtitle: "No. 1 Gen Set",
        riskState: "High Risk",
        riskScore: 62,
        signal: "Vibration rising (6 days)",
        action: "Inspect within 48h",
        sourceHealth: "Fresh",
        tone: "critical",
        icon: Gauge,
      },
      {
        equipmentId: "starboard-thruster",
        asset: "Starboard Thruster",
        subtitle: "Tunnel Thruster",
        riskState: "Watch",
        riskScore: 41,
        signal: "Vibration rising (2 days)",
        action: "Inspect within 7 days",
        sourceHealth: "Fresh",
        tone: "medium",
        icon: Cog,
      },
      {
        equipmentId: "main-engine",
        asset: "Main Engine",
        subtitle: "ME Port",
        riskState: "Normal",
        riskScore: 18,
        signal: "All parameters normal",
        action: "Continue watch",
        sourceHealth: "Fresh",
        tone: "good",
        icon: Wrench,
      },
      {
        equipmentId: "hydraulic-power-unit",
        asset: "Hydraulic Power Unit",
        subtitle: "HPU No.1",
        riskState: "Offline",
        riskScore: null,
        signal: "No data (2h 15m)",
        action: "Check sensor heartbeat",
        sourceHealth: "Offline",
        tone: "offline",
        icon: Gauge,
      },
    ],
    assetCase: {
      asset: "Port Generator",
      riskScore: 62,
      trend: "Rising",
      status: "In Service",
      sourceHealth: "Good",
      dataFreshness: "Fresh (2m)",
      evidenceSections: [
        {
          title: "Why at Risk?",
          body: "Vibration overall trending up for 6 days and exceeding warning threshold. Bearing condition degradation detected on DE side.",
        },
        {
          title: "Latest Abnormal Readings",
          body: "Vibration DE 7.8 mm/s, vibration NDE 5.2 mm/s, bearing temp 86.4 C.",
        },
        {
          title: "Recommended Next Action",
          body: "Inspect DE bearing and coupling alignment. Collect oil sample if not done in last 250 hrs.",
        },
        {
          title: "Linked Work Order",
          body: "WO-2025-1187 open, due 19 May 2025.",
        },
        {
          title: "Parts Likely Needed",
          body: "6316 C3 bearing, coupling element, Loctite 243.",
        },
        {
          title: "Responsible",
          body: "2/E Electrical / Chief Engineer.",
        },
        {
          title: "Evidence & Notes",
          body: "Telemetry packet, operator notes, and sensor health attached.",
        },
      ],
    },
    telemetryAdvanced: {
      trust: "Good",
      confidence: 92,
      lastUpdate: "2m ago",
      rawReadingsAvailable: true,
      sensorHealthCount: 4,
      chartAssetId: "telemetry-risk-chart",
    },
  };
}

function buildWorkScreen(): WorkScreen {
  return {
    filters: [
      { id: "all", label: "All", value: "23", tone: "info" },
      { id: "my-work", label: "My Work", value: "7", tone: "info" },
      { id: "overdue", label: "Overdue", value: "4", tone: "high" },
      { id: "watch", label: "Watch", value: "6", tone: "medium" },
    ],
    stageChips: [
      { id: "intake", label: "Intake", value: "3", tone: "normal" },
      { id: "triage", label: "Triage", value: "2", tone: "normal" },
      { id: "assigned", label: "Assigned", value: "5", tone: "normal" },
      { id: "in-progress", label: "In Progress", value: "4", tone: "info" },
      { id: "blocked", label: "Blocked", value: "2", tone: "high" },
    ],
    queue: sortQueue([
      {
        id: "sr-1258",
        title: "M/V Atlantic Trader",
        category: "SR-1258 - In Progress",
        reason: "Main Engine > Fuel System",
        detail: "Fuel leak at port side filter housing",
        severity: "high",
        owner: "J. Ramirez (Tech)",
        action: "Blocked by PdM Alert ALRT-8847",
        icon: Wrench,
        href: "/work-orders/sr-1258",
      },
      {
        id: "so-4481",
        title: "M/V Ocean Pioneer",
        category: "SO-4481 - Awaiting Parts",
        reason: "HVAC > Compressor #2",
        detail: "Compressor not cooling",
        severity: "medium",
        owner: "R. Patel (Tech)",
        action: "Part needed PRT-7732",
        icon: Package,
        href: "/work-orders/so-4481",
      },
      {
        id: "sr-1266",
        title: "M/V Seafarer",
        category: "SR-1266 - Awaiting Crew",
        reason: "Deck > Crane #1",
        detail: "Crane remote intermittent",
        severity: "normal",
        owner: "Deck Crew",
        action: "Crew needed 1 rigger",
        icon: Users,
        href: "/work-orders/sr-1266",
      },
      {
        id: "so-4476",
        title: "M/V Northern Light",
        category: "SO-4476 - Assigned",
        reason: "Generator #2 > Electrical",
        detail: "Frequent overload trips",
        severity: "high",
        owner: "A. Kim (Tech)",
        action: "PdM Alert ALRT-7712",
        icon: AlertTriangle,
        href: "/work-orders/so-4476",
      },
      {
        id: "sr-1271",
        title: "M/V Atlantic Trader",
        category: "SR-1271 - Awaiting Approval",
        reason: "Bilge System > Pump #1",
        detail: "Approval required before dispatch",
        severity: "normal",
        owner: "C. Wilson",
        action: "Approval required",
        icon: ClipboardCheck,
        href: "/work-orders/sr-1271",
      },
    ]),
    execution: {
      orderNumber: "SO-4481",
      vesselName: "M/V Ocean Pioneer",
      assetId: "vessel-borealis",
      title: "HVAC - Compressor #2",
      description: "Compressor not cooling",
      priority: "Medium",
      due: "Tomorrow 09:00",
      syncState: "Syncing...",
      technician: "R. Patel (Tech)",
      checklistProgress: "4 / 6",
      percentComplete: 67,
      checklist: [
        { label: "Isolate and lock out compressor", state: "done" },
        { label: "Verify no pressure and temperature normal", state: "done", telemetry: "Fresh" },
        { label: "Inspect compressor oil level and condition", state: "open" },
        { label: "Check cooling fan and motor operation", state: "done" },
        { label: "Test run and confirm cooling performance", state: "open" },
        { label: "Remove lockout and return to service", state: "open" },
      ],
      requiredPhotos: 3,
      partsUsed: "Filter, Oil - 51860 / P/N FLT-51860",
      labor: "2.50 hrs",
      photoAssetIds: ["work-compressor", "work-motor", "work-gauge"],
      offlineDraftAction: "Save Draft Offline",
      primaryAction: "Complete Work",
      notes: "Found oil level slightly low. Topped up. Fan belt tension adjusted. Running test.",
    },
  };
}

function buildLogsScreen(): LogsScreen {
  return {
    requiredBanner: "Daily logs are required. Please review and sign.",
    tabs: ["Overview", "Engine Log", "Deck Watch", "Condition Log", "Signoff"],
    autofillTrust: [
      { id: "fresh", label: "Fresh", value: "24 (86%)", tone: "good" },
      { id: "delayed", label: "Delayed", value: "3 (11%)", tone: "medium" },
      { id: "manual", label: "Manual Required", value: "1 (3%)", tone: "critical" },
    ],
    requiredCards: [
      {
        title: "Engine Log",
        subtitle: "Review and confirm auto-filled entries.",
        status: "Autofill Review",
      },
      {
        title: "Deck Watch Entry",
        subtitle: "4 / 4 watches entered",
        status: "Required",
      },
      {
        title: "Condition Log",
        subtitle: "1 item requires manual entry",
        status: "Required",
      },
      {
        title: "Captain Signoff",
        subtitle: "All logs must be reviewed and signed",
        status: "Required",
      },
    ],
    complianceHistory: [
      { id: "days", label: "Days", value: "7", tone: "info" },
      { id: "signed", label: "Signed", value: "100%", tone: "good" },
      { id: "overdue", label: "Overdue", value: "0", tone: "good" },
      { id: "remarks", label: "Remarks", value: "2", tone: "normal" },
    ],
    complianceRows: [
      { date: "May 11, 2025", status: "Signed", signer: "CPT A. James" },
      { date: "May 10, 2025", status: "Signed", signer: "CPT A. James" },
      { date: "May 9, 2025", status: "Signed", signer: "CPT A. James" },
    ],
  };
}

function buildCrewScreen(): CrewScreen {
  return {
    vesselName: "USV Navigator",
    readiness: [
      { id: "onboard", label: "Onboard", value: "18", tone: "good" },
      { id: "assigned", label: "Assigned", value: "4", tone: "info" },
      { id: "available", label: "Available", value: "6", tone: "normal" },
      { id: "missing", label: "Missing Roles", value: "2", tone: "critical" },
    ],
    blockers: [
      {
        id: "cert-expiring",
        title: "2 Certificates Expiring",
        category: "Crew",
        reason: "Within 30 days",
        detail: "Current crew documents",
        severity: "medium",
        owner: "Crewing",
        action: "Review certificates",
        icon: FileCheck2,
        href: "/crew-management",
      },
      {
        id: "cert-expired",
        title: "1 Certificate Expired",
        category: "Crew",
        reason: "Requires action",
        detail: "High priority",
        severity: "critical",
        owner: "Crewing",
        action: "Assign replacement",
        icon: Bell,
        href: "/crew-management",
      },
    ],
    currentCrew: [
      {
        name: "Michael Johnson",
        rank: "Master",
        status: "Onboard",
        docs: "10/10",
        avatarAssetId: "avatar-michael",
      },
      {
        name: "Sarah Chen",
        rank: "Chief Officer",
        status: "Onboard",
        docs: "9/10",
        avatarAssetId: "avatar-sarah",
      },
      {
        name: "Daniel Garcia",
        rank: "Chief Engineer",
        status: "Onboard",
        docs: "8/10",
        avatarAssetId: "avatar-daniel",
      },
    ],
    formerCrew: [
      {
        name: "James Williams",
        rank: "2nd Engineer",
        status: "Signed Off",
        date: "05 May 2025",
        avatarAssetId: "avatar-alex",
      },
    ],
  };
}

function buildInventoryScreen(): InventoryScreen {
  return {
    actionRequired: [
      { id: "reorder", label: "Reorder Needed", value: "5", tone: "critical" },
      { id: "low-stock", label: "Low Stock", value: "3", tone: "medium" },
      { id: "deliveries", label: "Deliveries", value: "2", tone: "info" },
      { id: "linked", label: "Linked to WO", value: "4", tone: "medium" },
    ],
    rows: [
      {
        partNumber: "100-200-300",
        name: "Hydraulic Filter HF-3000",
        location: "AFT Store Shelf 2",
        onHand: 12,
        available: 8,
        reorderStatus: "OK",
        tone: "good",
      },
      {
        partNumber: "200-450-100",
        name: "O-Ring Kit BSK-450",
        location: "FWD Store Bin 4",
        onHand: 4,
        available: 1,
        reorderStatus: "Low",
        tone: "medium",
      },
      {
        partNumber: "300-100-050",
        name: "Pump Seal PS-100",
        location: "AFT Store Drawer 1",
        onHand: 2,
        available: 0,
        reorderStatus: "Reorder",
        tone: "critical",
      },
      {
        partNumber: "400-600-150",
        name: "Valve Assy VA-600",
        location: "Deck Store Shelf 1",
        onHand: 5,
        available: 2,
        reorderStatus: "Low",
        tone: "medium",
      },
      {
        partNumber: "500-700-200",
        name: "Bearing BRG-700",
        location: "FWD Store Bin 7",
        onHand: 7,
        available: 4,
        reorderStatus: "OK",
        tone: "good",
      },
    ],
    linkedWorkOrders: [
      {
        id: "WO-2025-1348",
        title: "Main Engine Overhaul - Stage 2",
        status: "3 items",
      },
    ],
    logisticsTasks: [
      {
        id: "DEL-2025-0891",
        title: "Spare Parts Delivery",
        eta: "ETA: 16 May 2025",
      },
    ],
  };
}

function buildSettingsScreen(role: MobileRole): SettingsScreen {
  return {
    profile: {
      name: role === "crew" ? "R. Patel" : "Alex Morgan",
      role: role === "crew" ? "Technician" : "System Administrator",
      email: role === "crew" ? "r.patel@arusmaritime.com" : "admin@arusmaritime.com",
      avatarAssetId: "avatar-alex",
    },
    items: [
      { label: "Profile", icon: Users },
      {
        label: "Switch Portal / Organization",
        detail: "ARUS Maritime / Oceanic Group",
        icon: Ship,
      },
      { label: "Notifications", icon: Bell },
      { label: "Offline Sync", detail: "Last synced: 09:30", icon: Cloud, tone: "good" },
      { label: "System Configuration", icon: Cog },
      { label: "Sensors + Telemetry Setup", icon: RadioTower },
      { label: "Integrations", icon: Gauge },
      { label: "Roles + Hub Access", icon: Users },
      { label: "Copilot + Knowledge Base Settings", icon: BookOpen },
      { label: "System Health", icon: Shield },
    ],
  };
}

export function buildMobileReadinessScreens(
  roleInput: string | null | undefined
): MobileReadinessScreens {
  const role = normalizeMobileRole(roleInput);
  return {
    nav: buildMobileReadinessNavigation(role),
    today: buildTodayScreen(role),
    fleet: buildFleetScreen(),
    pdm: buildPdmScreen(),
    work: buildWorkScreen(),
    logs: buildLogsScreen(),
    crew: buildCrewScreen(),
    inventory: buildInventoryScreen(),
    settings: buildSettingsScreen(role),
  };
}
