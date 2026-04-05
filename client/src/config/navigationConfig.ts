import {
  Gauge,
  Ship,
  Wrench,
  BarChart3,
  Settings,
  Bell,
  Server,
  AlertCircle,
  Zap,
  Package,
  Users,
  ClipboardCheck,
  TrendingUp,
  LayoutDashboard,
  Shield,
  Activity,
  Building,
  Lightbulb,
  Boxes,
  ShoppingCart,
  Truck,
  Database,
  SlidersHorizontal,
  BookOpen,
  Clipboard,
  Anchor,
  Bot,
  Box,
  Brain,
  type LucideIcon,
} from "lucide-react";

// Core navigation item type
export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  resource?: string;
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
  "/dashboard": "dashboard",
  "/active-telemetry": "sensors",
  "/alerts": "alerts",
  "/actionable-insights": "ai_reports",
  "/governance-dashboard": "compliance_reports",
  "/diagnostics": "system_settings",
  
  // Fleet
  "/fleet": "vessels",
  "/fleet-overview": "vessels",
  "/vessel-management": "vessels",
  "/equipment": "equipment",
  "/health": "equipment",
  
  // Maintenance
  "/maint": "work_orders",
  "/work-orders": "work_orders",
  "/maintenance": "maintenance_schedules",
  "/maintenance-templates": "maintenance_templates",
  "/pdm-pack": "predictive_maintenance",
  "/pdm-dashboard": "predictive_maintenance",
  "/pdm-platform": "predictive_maintenance",
  "/digital-twin": "predictive_maintenance",
  
  // Crew
  "/crew": "crew_members",
  "/crew-management": "crew_members",
  "/crew-scheduler": "crew_schedules",
  "/schedule-planner": "crew_schedules",
  "/hours-of-rest": "rest_hours",
  "/ops/schedule": "crew_schedules",
  
  // Logistics / Inventory
  "/logistics": "inventory",
  "/inventory-management": "inventory",
  "/purchase-orders": "purchase_requests",
  "/purchase-requests": "purchase_requests",
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
      { name: "Dashboard", href: "/dashboard", icon: Gauge, description: "Overview, metrics, alerts" },
      { name: "Active Telemetry", href: "/active-telemetry", icon: Activity, description: "Live sensor streams and graphs" },
      { name: "Actionable Insights", href: "/actionable-insights", icon: Lightbulb, description: "AI recommendations" },
    ],
  },
  {
    id: "fleet",
    name: "Fleet",
    icon: Ship,
    hubRoute: "/fleet",
    description: "Vessels and equipment management",
    children: [
      { name: "Vessels", href: "/vessel-management", icon: Ship, description: "Fleet overview and vessel details" },
      { name: "Equipment", href: "/equipment", icon: Server, description: "Equipment registry and health" },
    ],
  },
  {
    id: "maintenance",
    name: "Maintenance",
    icon: Wrench,
    hubRoute: "/maint",
    description: "Work orders, schedules, and PDM",
    children: [
      { name: "Work Orders", href: "/work-orders", icon: ClipboardCheck, description: "Work order management" },
      { name: "Schedules", href: "/maintenance", icon: Wrench, description: "Maintenance schedules" },
      { name: "Templates", href: "/maintenance-templates", icon: Clipboard, description: "Maintenance templates" },
      { name: "PdM Pack", href: "/pdm-pack", icon: Zap, description: "Predictive maintenance tools" },
      { name: "PdM Dashboard", href: "/pdm-dashboard", icon: TrendingUp, description: "Risk queue & fleet health" },
      { name: "PdM Platform", href: "/pdm-platform", icon: Database, description: "Feature store, models, inference & monitoring" },
      { name: "Digital Twin", href: "/digital-twin", icon: Box, description: "Asset-level digital twins with state, residuals & scenarios" },
    ],
  },
  {
    id: "crew",
    name: "Crew",
    icon: Users,
    hubRoute: "/crew",
    description: "Crew management and scheduling",
    children: [
      { name: "Crew Management", href: "/crew-management", icon: Users, description: "Crew roster and details" },
      { name: "Schedule Planner", href: "/schedule-planner", icon: ClipboardCheck, description: "SmartPAL crew scheduling" },
      { name: "Hours of Rest", href: "/hours-of-rest", icon: Activity, description: "STCW compliance tracking" },
      { name: "Schedule Board", href: "/ops/schedule", icon: LayoutDashboard, description: "Visual schedule board" },
    ],
  },
  {
    id: "logistics",
    name: "Logistics",
    icon: Package,
    hubRoute: "/logistics",
    description: "Inventory, purchasing, and suppliers",
    children: [
      { name: "Inventory", href: "/inventory-management", icon: Boxes, description: "Parts and stock management" },
      { name: "Purchasing", href: "/purchase-requests", icon: ClipboardCheck, description: "Purchase requests & orders" },
      { name: "Service Orders", href: "/service-orders", icon: Wrench, description: "Service order management" },
      { name: "Vendors", href: "/vendors", icon: Building, description: "Suppliers & service providers" },
    ],
  },
  {
    id: "records",
    name: "Records",
    icon: Clipboard,
    hubRoute: "/logs",
    description: "Logbooks and compliance records",
    children: [
      { name: "Compliance", href: "/logs/compliance", icon: Shield, description: "Compliance & governance" },
      { name: "Deck Log", href: "/logs/deck", icon: Anchor, description: "Deck logbook & vessel track" },
      { name: "Engine Log", href: "/logs/engine", icon: Wrench, description: "Engine room & fuel" },
      { name: "Equipment Log", href: "/logs/equipment", icon: Activity, description: "Condition & decommissioned" },
      { name: "RMS Monitoring", href: "/rms-monitoring", icon: Gauge, description: "Aquametro fuel monitoring & alerts", resource: "sensors" },
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    icon: BarChart3,
    hubRoute: "/analytics",
    description: "Reports, AI, and performance tracking",
    children: [
      { name: "Equipment Intelligence", href: "/equipment-intelligence", icon: Brain, description: "Consolidated AI health, predictions & recommendations" },
      { name: "AI Health", href: "/ai-health", icon: TrendingUp, description: "Fleet AI status and predictions" },
      { name: "Analytics Dashboard", href: "/analytics", icon: BarChart3, description: "Reports and analytics" },
      { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, description: "Documentation and RAG" },
      { name: "KB Assistant", href: "/kb-chat", icon: Bot, description: "AI-powered knowledge assistant" },
      { name: "AI Sensor Audits", href: "/ai-sensor-audits", icon: Activity, description: "AI sensor analysis" },
      { name: "Optimizer", href: "/optimization-tools", icon: Zap, description: "Maintenance optimization tools" },
    ],
  },
  {
    id: "system",
    name: "System",
    icon: Settings,
    hubRoute: "/system",
    description: "Settings, admin, and sensors",
    children: [
      { name: "Configuration", href: "/configuration", icon: Settings, description: "System configuration" },
      { name: "Notifications", href: "/notifications", icon: Bell, description: "Email alerts, preferences & templates" },
      { name: "Organizations", href: "/organization-management", icon: Building, description: "Multi-tenant settings" },
      { name: "Sensor Templates", href: "/sensor-templates", icon: SlidersHorizontal, description: "Sensor templates" },
      { name: "Sensors", href: "/sensors", icon: Activity, description: "Sensor management" },
      { name: "StormGeo", href: "/stormgeo-settings", icon: Database, description: "Weather integration" },
      { name: "System Admin", href: "/system-administration", icon: Shield, description: "Admin tools" },
      { name: "Diagnostics", href: "/diagnostics", icon: AlertCircle, description: "System diagnostics" },
    ],
  },
];

// Helper: Get category by ID
export function getCategoryById(id: string): NavigationCategory | undefined {
  return navigationCategories.find(cat => cat.id === id);
}

// Route migration map for legacy dock entries
export const routeMigrations: Record<string, string> = {
  "/governance": "/logs/compliance",
  "/governance-dashboard": "/logs/compliance",
  "/logs-compliance": "/logs/compliance",
  "/deck-logbook": "/logs/deck",
  "/vessel-track-log": "/logs/deck",
  "/engine-logbook": "/logs/engine",
  "/fuel-emissions-log": "/logs/engine",
  "/condition-monitoring-log": "/logs/equipment",
  "/decommissioned-equipment-log": "/logs/equipment",
  "/devices": "/equipment",
  "/equipment-registry": "/equipment",
  "/health-monitor": "/equipment",
  "/health": "/equipment",
  "/fleet-overview": "/vessel-management",
  "/bridge-view": "/fleet",
  "/settings": "/configuration",
  "/transport-settings": "/configuration",
  "/storage-settings": "/configuration",
  "/operating-parameters": "/configuration",
  "/sensor-config": "/sensors",
  "/sensor-optimization": "/sensors",
  "/sensor-management": "/sensors",
  "/cost-savings": "/analytics",
  "/reports": "/analytics",
  "/model-performance": "/analytics",
  "/ml-explainability": "/analytics",
  "/prediction-feedback": "/analytics",
  "/llm-costs": "/analytics",
  "/alerts": "/dashboard",
};

// Helper: Migrate legacy route to current route
export function migrateRoute(href: string): string {
  return routeMigrations[href] || href;
}

// Helper: Get all items for dock (flattened)
export function getAllNavigationItems(): NavigationItem[] {
  return navigationCategories.flatMap(cat => cat.children);
}

// Legacy support: homePageGroups format (maps to categories)
export interface HomePageGroup {
  id: string;
  name: string;
  items: NavigationItem[];
}

export const homePageGroups: HomePageGroup[] = navigationCategories.map(cat => ({
  id: cat.id,
  name: cat.name,
  items: cat.children,
}));
