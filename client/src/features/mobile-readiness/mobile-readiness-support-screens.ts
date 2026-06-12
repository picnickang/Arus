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
} from "lucide-react";
import type {
  CrewScreen,
  InventoryScreen,
  LogsScreen,
  MobileReadinessScreens,
  MobileRole,
  SettingsScreen,
} from "./mobile-readiness-model-types";
import { buildMobileReadinessNavigation, normalizeMobileRole } from "./mobile-readiness-navigation";
import { buildFleetScreen, buildTodayScreen } from "./mobile-readiness-queue-fleet";
import { buildPdmScreen, buildWorkScreen } from "./mobile-readiness-machinery-work";

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
