import {
  Gauge,
  Ship,
  Wrench,
  BarChart3,
  Settings,
  Bell,
  AlertCircle,
  Package,
  Users,
  ClipboardCheck,
  Shield,
  Activity,
  Building,
  Boxes,
  Database,
  SlidersHorizontal,
  Zap,
  BookOpen,
  Clipboard,
  Anchor,
  Brain,
  FileText,
  QrCode,
  CloudOff,
  type LucideIcon,
} from "lucide-react";

// Core navigation item type
export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  resource?: string;
  badgeKey?: string;
}

// Category with hub route and child pages
export interface NavigationCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  hubRoute: string;
  description: string;
  children: NavigationItem[];
  resource?: string;
}

// Map route paths to permission resources
// Resource codes must match server/config/permission-registry.ts exactly
export const routeResourceMap: Record<string, string> = {
  // Operations
  "/findings": "dashboard",
  "/briefing": "dashboard",
  "/attention-inbox": "dashboard",
  "/offline-outbox": "dashboard",
  "/alerts": "alerts",
  "/governance-dashboard": "compliance_reports",
  "/diagnostics": "system_settings",

  // Fleet
  "/fleet": "vessels",
  "/fleet-overview": "vessels",
  "/vessel-management": "vessels",
  "/equipment": "vessels",
  "/equipment-scan": "vessels",
  "/certificates": "vessels",
  "/health": "vessels",

  // Maintenance
  "/maint": "work_orders",
  "/work-orders": "work_orders",
  "/maintenance": "maintenance_schedules",
  "/maintenance-templates": "maintenance_templates",
  "/pdm-platform": "predictive_maintenance",
  "/digital-twin": "predictive_maintenance",

  // Crew
  "/crew": "crew_members",
  "/crew-management": "crew_members",
  "/crew-scheduler": "crew_schedules",
  "/schedule-planner": "crew_schedules",
  "/hours-of-rest": "rest_hours",

  // Logistics / Inventory
  "/logistics": "inventory",
  "/inventory-management": "inventory",
  "/purchase-orders": "inventory",
  "/purchase-requests": "inventory",
  "/service-orders": "service_orders",
  "/vendors": "suppliers",
  "/suppliers": "suppliers",
  "/service-providers": "suppliers",

  // Records / Logbooks (consolidated)
  "/logs": "deck_logbook",
  "/logs/compliance": "compliance_reports",
  "/logs/deck": "deck_logbook",
  "/logs/engine": "engine_logbook",
  "/logs/equipment": "condition_monitoring",
  // Legacy routes (kept for backward compatibility)
  "/deck-logbook": "deck_logbook",
  "/engine-logbook": "engine_logbook",
  "/fuel-emissions-log": "engine_logbook",
  "/vessel-track-log": "deck_logbook",
  "/condition-monitoring-log": "condition_monitoring",
  "/rms-monitoring": "sensors",
  "/logs-compliance": "compliance_reports",

  // Analytics
  "/equipment-intelligence": "predictive_maintenance",
  "/analytics": "analytics_dashboard",
  "/ai-health": "predictive_maintenance",
  "/knowledge-base": "ai_reports",
  "/ai-sensor-audits": "sensors",
  "/optimization-tools": "predictive_maintenance",

  // System
  "/system": "system_settings",
  "/configuration": "system_settings",
  "/notifications": "system_settings",
  "/organization-management": "organization_settings",
  "/sensor-templates": "sensors",
  "/sensors": "sensors",
  "/stormgeo-settings": "integrations",
  "/system-administration": "system_settings",
};

// 8 Top-Level Categories - Single Source of Truth
export const navigationCategories: NavigationCategory[] = [
  {
    id: "operations",
    name: "Operations",
    icon: Gauge,
    hubRoute: "/operations",
    description: "Dashboard, telemetry, and insights",
    children: [
      {
        name: "Attention Inbox",
        href: "/attention-inbox",
        icon: AlertCircle,
        description: "Unified risk, blockers, handover, and next-action queue",
        badgeKey: "attention-open",
      },
      {
        name: "Agent Findings",
        href: "/findings",
        icon: Brain,
        description: "Unified AI agent activity feed",
        badgeKey: "findings-pending",
      },
      {
        name: "Daily Briefing",
        href: "/briefing",
        icon: FileText,
        description: "Automated shift-start summary",
        badgeKey: "briefing-new",
      },
      {
        name: "Offline Outbox",
        href: "/offline-outbox",
        icon: CloudOff,
        description: "Queued vessel changes, sync status, and conflicts",
        badgeKey: "offline-pending",
      },
    ],
  },
  {
    id: "fleet",
    name: "Fleet",
    icon: Ship,
    hubRoute: "/fleet",
    description: "Vessels and equipment management",
    children: [
      {
        name: "Certificates",
        href: "/certificates",
        icon: Shield,
        description: "Vessel & equipment certificate registry",
      },
      {
        name: "Scan Equipment",
        href: "/equipment-scan",
        icon: QrCode,
        description: "QR/asset tag entry to equipment health, jobs, parts, and logs",
      },
    ],
  },
  {
    id: "maintenance",
    name: "Maintenance",
    icon: Wrench,
    hubRoute: "/maint",
    description: "Work orders, schedules, and PDM",
    children: [
      {
        name: "Work Orders",
        href: "/work-orders",
        icon: ClipboardCheck,
        description: "Work order management",
      },
      {
        name: "Schedules",
        href: "/maintenance",
        icon: Wrench,
        description: "Maintenance schedules",
      },
      {
        name: "Templates",
        href: "/maintenance-templates",
        icon: Clipboard,
        description: "Maintenance templates",
      },
      {
        name: "Equipment Intelligence",
        href: "/equipment-intelligence",
        icon: Brain,
        description: "AI health, predictions & recommendations",
      },
    ],
  },
  {
    id: "crew",
    name: "Crew",
    icon: Users,
    hubRoute: "/crew",
    description: "Crew management and scheduling",
    children: [
      {
        name: "Crew Management",
        href: "/crew-management",
        icon: Users,
        description: "Crew roster and details",
      },
      {
        name: "Schedule Planner",
        href: "/crew-scheduler",
        icon: ClipboardCheck,
        description: "SmartPAL crew scheduling",
      },
      {
        name: "Hours of Rest",
        href: "/hours-of-rest",
        icon: Activity,
        description: "STCW compliance tracking",
      },
    ],
  },
  {
    id: "logistics",
    name: "Logistics",
    icon: Package,
    hubRoute: "/logistics",
    description: "Inventory, purchasing, and suppliers",
    children: [
      {
        name: "Inventory",
        href: "/logistics?tab=inventory",
        icon: Boxes,
        description: "Parts, stock management & purchasing",
      },
      {
        name: "Service Orders",
        href: "/service-orders",
        icon: Wrench,
        description: "Service order management",
      },
      {
        name: "Vendors",
        href: "/logistics?tab=vendors",
        icon: Building,
        description: "Suppliers & service providers",
      },
    ],
  },
  {
    id: "records",
    name: "Records",
    icon: Clipboard,
    hubRoute: "/logs",
    description: "Logbooks and compliance records",
    children: [
      {
        name: "Compliance",
        href: "/logs/compliance",
        icon: Shield,
        description: "Compliance & governance",
      },
      {
        name: "Deck Log",
        href: "/logs/deck",
        icon: Anchor,
        description: "Deck logbook & vessel track",
      },
      { name: "Engine Log", href: "/logs/engine", icon: Wrench, description: "Engine room & fuel" },
      {
        name: "Equipment Log",
        href: "/logs/equipment",
        icon: Activity,
        description: "Condition & decommissioned",
      },
      {
        name: "RMS Monitoring",
        href: "/rms-monitoring",
        icon: Gauge,
        description: "Aquametro fuel monitoring & alerts",
        resource: "sensors",
      },
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    icon: BarChart3,
    hubRoute: "/analytics",
    description: "Reports, AI, and performance tracking",
    children: [
      {
        name: "Analytics Dashboard",
        href: "/analytics",
        icon: BarChart3,
        description: "Reports and analytics",
      },
      {
        name: "Knowledge Base",
        href: "/knowledge-base",
        icon: BookOpen,
        description: "Documentation and RAG",
      },
      {
        name: "Optimizer",
        href: "/optimization-tools",
        icon: Zap,
        description: "Maintenance optimization tools",
      },
    ],
  },
  {
    id: "system",
    name: "System",
    icon: Settings,
    hubRoute: "/system",
    description: "Settings, admin, and sensors",
    children: [
      {
        name: "Configuration",
        href: "/configuration",
        icon: Settings,
        description: "System configuration",
      },
      {
        name: "Notifications",
        href: "/notifications",
        icon: Bell,
        description: "Email alerts, preferences & templates",
      },
      {
        name: "Organizations",
        href: "/organization-management",
        icon: Building,
        description: "Multi-tenant settings",
      },
      {
        name: "Sensor Templates",
        href: "/sensor-templates",
        icon: SlidersHorizontal,
        description: "Sensor templates",
      },
      { name: "Sensors", href: "/sensors", icon: Activity, description: "Sensor management" },
      {
        name: "StormGeo",
        href: "/stormgeo-settings",
        icon: Database,
        description: "Weather integration",
      },
      {
        name: "System Admin",
        href: "/system-administration",
        icon: Shield,
        description: "Admin tools",
      },
      {
        name: "System Health",
        href: "/diagnostics",
        icon: AlertCircle,
        description: "System health & diagnostics",
      },
    ],
  },
];

// Helper: Get category by ID
export function getCategoryById(id: string): NavigationCategory | undefined {
  return navigationCategories.find((cat) => cat.id === id);
}

// Strip query string / hash from a route path, leaving the bare path.
function baseRoutePath(path: string): string {
  return (path.split("?")[0] ?? path).split("#")[0] ?? path;
}

// Authoritative route → hub (nav category) id map for every route the user
// can actually navigate to from the nav surface. Derived from
// `navigationCategories` (the single source of truth) so the mapping always
// reflects the hub a page is *shown under*, which is what a hub-granted user
// expects to be able to open. This deliberately captures user-facing
// placement even when it differs from a page's structural route group — e.g.
// "Equipment Intelligence" is shown under Maintenance and "Optimizer" under
// Analytics. Deep routes that are not nav children are classified by their
// route group at the App.tsx composition layer (see `resolveRouteHubId`).
export const ROUTE_HUB_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const cat of navigationCategories) {
    map[baseRoutePath(cat.hubRoute)] = cat.id;
    for (const child of cat.children) {
      map[baseRoutePath(child.href)] = cat.id;
    }
  }
  return map;
})();

// Resolve the hub id for a nav-visible route path (query string ignored).
// Returns null for routes not present in the nav surface; callers that also
// know a route's structural group (App.tsx) supply that as a fallback.
export function getHubIdForRoute(path: string): string | null {
  return ROUTE_HUB_MAP[baseRoutePath(path)] ?? null;
}

// Route migration map for legacy dock entries
export const routeMigrations: Record<string, string> = {
  "/attention": "/attention-inbox",
  "/outbox": "/offline-outbox",
  "/sync-outbox": "/offline-outbox",
  "/compliance/findings": "/logs/compliance?tab=findings",
  "/health-monitor": "/equipment-intelligence",
  "/pdm-dashboard": "/equipment-intelligence",
  "/pdm-pack": "/pdm-platform?tab=diagnostics",
  "/pdm/schedule": "/pdm-platform?tab=schedule",
  "/governance-dashboard": "/logs?tab=compliance",
  "/governance": "/logs?tab=compliance",
  "/logs-compliance": "/logs?tab=compliance",
  "/deck-logbook": "/logs?tab=deck",
  "/vessel-track-log": "/logs?tab=deck",
  "/engine-logbook": "/logs?tab=engine",
  "/fuel-emissions-log": "/logs?tab=engine",
  "/condition-monitoring-log": "/logs?tab=equipment",
  "/decommissioned-equipment-log": "/logs?tab=equipment",
  "/inventory-management": "/logistics?tab=inventory",
  "/vendors": "/logistics?tab=vendors",
  "/suppliers": "/logistics?tab=vendors",
  "/service-providers": "/logistics?tab=vendors",
  "/devices": "/fleet?tab=equipment",
};

// Helper: Migrate legacy route to current route
export function migrateRoute(href: string): string {
  return routeMigrations[href] || href;
}

// Helper: Get all items for dock (flattened)
export function getAllNavigationItems(): NavigationItem[] {
  return navigationCategories.flatMap((cat) => cat.children);
}

// Legacy support: homePageGroups format (maps to categories)
export interface HomePageGroup {
  id: string;
  name: string;
  items: NavigationItem[];
}

export const homePageGroups: HomePageGroup[] = navigationCategories.map((cat) => ({
  id: cat.id,
  name: cat.name,
  items:
    cat.children.length > 0
      ? cat.children
      : [{ name: cat.name, href: cat.hubRoute, icon: cat.icon, description: cat.description }],
}));
