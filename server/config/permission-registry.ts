/**
 * Permission Registry - Centralized Resource and Action Definitions
 *
 * Single source of truth for all resources and actions in the application.
 * Add new pages/features here to make them available for permission management.
 */

export interface ResourceDefinition {
  code: string;
  name: string;
  description: string;
  category: ResourceCategory;
  icon?: string;
  actions: ActionCode[];
  sortOrder: number;
}

export interface ActionDefinition {
  code: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  sortOrder: number;
}

export type ResourceCategory =
  | "operations"
  | "maintenance"
  | "crew"
  | "inventory"
  | "analytics"
  | "compliance"
  | "settings";

export type ActionCode =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "approve"
  | "assign"
  | "complete"
  | "manage_parts"
  | "manage_config"
  | "manage"
  | "trigger"
  | "clear"
  | "acknowledge"
  | "sign_off"
  | "override";

export const ACTIONS: Record<ActionCode, ActionDefinition> = {
  view: {
    code: "view",
    name: "View",
    description: "View and read data",
    riskLevel: "low",
    sortOrder: 1,
  },
  create: {
    code: "create",
    name: "Create",
    description: "Create new records",
    riskLevel: "medium",
    sortOrder: 2,
  },
  edit: {
    code: "edit",
    name: "Edit",
    description: "Modify existing records",
    riskLevel: "medium",
    sortOrder: 3,
  },
  delete: {
    code: "delete",
    name: "Delete",
    description: "Remove records permanently",
    riskLevel: "high",
    sortOrder: 4,
  },
  export: {
    code: "export",
    name: "Export",
    description: "Export data to files",
    riskLevel: "medium",
    sortOrder: 5,
  },
  approve: {
    code: "approve",
    name: "Approve",
    description: "Approve submissions or requests",
    riskLevel: "high",
    sortOrder: 6,
  },
  assign: {
    code: "assign",
    name: "Assign",
    description: "Assign tasks or resources to crew",
    riskLevel: "medium",
    sortOrder: 7,
  },
  complete: {
    code: "complete",
    name: "Complete",
    description: "Mark items as completed",
    riskLevel: "medium",
    sortOrder: 8,
  },
  manage_parts: {
    code: "manage_parts",
    name: "Manage Parts",
    description: "Add or remove parts from work orders",
    riskLevel: "high",
    sortOrder: 9,
  },
  manage_config: {
    code: "manage_config",
    name: "Manage Configuration",
    description: "Change system or sensor configurations",
    riskLevel: "critical",
    sortOrder: 10,
  },
  manage: {
    code: "manage",
    name: "Manage",
    description: "Manage operational definitions and configuration",
    riskLevel: "critical",
    sortOrder: 11,
  },
  trigger: {
    code: "trigger",
    name: "Trigger",
    description: "Trigger operational alerts or alarms",
    riskLevel: "high",
    sortOrder: 12,
  },
  clear: {
    code: "clear",
    name: "Clear",
    description: "Clear active operational alerts or alarms",
    riskLevel: "high",
    sortOrder: 13,
  },
  acknowledge: {
    code: "acknowledge",
    name: "Acknowledge",
    description: "Acknowledge alerts, alarms, or required reviews",
    riskLevel: "medium",
    sortOrder: 14,
  },
  sign_off: {
    code: "sign_off",
    name: "Sign Off",
    description: "Officially sign off on logbook entries or compliance documents",
    riskLevel: "high",
    sortOrder: 15,
  },
  override: {
    code: "override",
    name: "Override",
    description: "Override system recommendations or safety checks",
    riskLevel: "critical",
    sortOrder: 16,
  },
};

export const RESOURCES: ResourceDefinition[] = [
  // Operations
  {
    code: "dashboard",
    name: "Dashboard",
    description: "Main dashboard with fleet overview",
    category: "operations",
    icon: "LayoutDashboard",
    actions: ["view"],
    sortOrder: 1,
  },
  {
    code: "vessels",
    name: "Vessels",
    description: "Fleet vessel management",
    category: "operations",
    icon: "Ship",
    actions: ["view", "create", "edit", "delete", "export"],
    sortOrder: 2,
  },
  {
    code: "equipment",
    name: "Equipment",
    description: "Equipment registry and details",
    category: "operations",
    icon: "Wrench",
    actions: ["view", "create", "edit", "delete", "manage_config"],
    sortOrder: 3,
  },
  {
    code: "sensors",
    name: "Sensors",
    description: "Sensor configuration and monitoring",
    category: "operations",
    icon: "Activity",
    actions: ["view", "create", "edit", "delete", "manage_config"],
    sortOrder: 4,
  },

  // Maintenance
  {
    code: "work_orders",
    name: "Work Orders",
    description: "Maintenance work orders",
    category: "maintenance",
    icon: "ClipboardList",
    actions: ["view", "create", "edit", "delete", "assign", "complete", "manage_parts"],
    sortOrder: 10,
  },
  {
    code: "maintenance_schedules",
    name: "Maintenance Schedules",
    description: "Planned maintenance scheduling",
    category: "maintenance",
    icon: "Calendar",
    actions: ["view", "create", "edit", "delete", "approve"],
    sortOrder: 11,
  },
  {
    code: "maintenance_templates",
    name: "Maintenance Templates",
    description: "Reusable maintenance templates",
    category: "maintenance",
    icon: "FileCode",
    actions: ["view", "create", "edit", "delete"],
    sortOrder: 12,
  },
  {
    code: "alerts",
    name: "Alerts",
    description: "Equipment alerts and notifications",
    category: "maintenance",
    icon: "Bell",
    actions: ["view", "edit", "delete", "manage_config"],
    sortOrder: 13,
  },

  // Crew
  {
    code: "crew_members",
    name: "Crew Members",
    description: "Crew roster and profiles",
    category: "crew",
    icon: "Users",
    actions: ["view", "create", "edit", "delete", "export"],
    sortOrder: 20,
  },
  {
    code: "crew_schedules",
    name: "Crew Schedules",
    description: "Work schedules and assignments",
    category: "crew",
    icon: "CalendarDays",
    actions: ["view", "create", "edit", "delete", "assign"],
    sortOrder: 21,
  },
  {
    code: "rest_hours",
    name: "Rest Hours",
    description: "STCW rest hour tracking",
    category: "crew",
    icon: "Clock",
    actions: ["view", "create", "edit", "delete", "approve", "sign_off"],
    sortOrder: 22,
  },
  {
    code: "certifications",
    name: "Certifications",
    description: "Crew certifications and training",
    category: "crew",
    icon: "Award",
    actions: ["view", "create", "edit", "delete"],
    sortOrder: 23,
  },
  {
    code: "safety_alarms",
    name: "Safety Alarms",
    description: "Operational safety alarm viewing and response",
    category: "crew",
    icon: "ShieldAlert",
    actions: ["view", "trigger", "clear", "acknowledge", "export"],
    sortOrder: 24,
  },
  {
    code: "safety_alarm_types",
    name: "Safety Alarm Types",
    description: "Configure available safety alarm definitions",
    category: "crew",
    icon: "Bell",
    actions: ["view", "manage"],
    sortOrder: 25,
  },
  {
    code: "leave_requests",
    name: "Leave Requests",
    description: "Crew leave management",
    category: "crew",
    icon: "Plane",
    actions: ["view", "create", "edit", "delete", "approve"],
    sortOrder: 26,
  },

  // Inventory
  {
    code: "inventory",
    name: "Inventory",
    description: "Parts and supplies inventory",
    category: "inventory",
    icon: "Package",
    actions: ["view", "create", "edit", "delete", "export"],
    sortOrder: 30,
  },
  {
    code: "inventory_movements",
    name: "Inventory Movements",
    description: "Stock movements and adjustments",
    category: "inventory",
    icon: "ArrowLeftRight",
    actions: ["view", "create", "edit", "delete"],
    sortOrder: 31,
  },
  {
    code: "purchase_requests",
    name: "Purchase Requests",
    description: "Procurement and purchasing",
    category: "inventory",
    icon: "ShoppingCart",
    actions: ["view", "create", "edit", "delete", "approve"],
    sortOrder: 32,
  },
  {
    code: "suppliers",
    name: "Suppliers",
    description: "Supplier management",
    category: "inventory",
    icon: "Building2",
    actions: ["view", "create", "edit", "delete"],
    sortOrder: 33,
  },
  {
    code: "service_orders",
    name: "Service Orders",
    description: "External service provider orders",
    category: "inventory",
    icon: "FileText",
    actions: ["view", "create", "edit", "delete", "approve"],
    sortOrder: 34,
  },
  {
    code: "service_requests",
    name: "Service Requests",
    description: "Service request workflow for procurement review",
    category: "inventory",
    icon: "ClipboardList",
    actions: ["view", "create", "edit", "delete", "approve"],
    sortOrder: 35,
  },

  // Compliance
  {
    code: "deck_logbook",
    name: "Deck Logbook",
    description: "Bridge deck operations log",
    category: "compliance",
    icon: "BookOpen",
    actions: ["view", "create", "edit", "delete", "sign_off", "export"],
    sortOrder: 40,
  },
  {
    code: "engine_logbook",
    name: "Engine Logbook",
    description: "Engine room operations log",
    category: "compliance",
    icon: "Cog",
    actions: ["view", "create", "edit", "delete", "sign_off", "export"],
    sortOrder: 41,
  },
  {
    code: "compliance_findings",
    name: "Compliance Findings",
    description: "Audit findings and NCRs",
    category: "compliance",
    icon: "ShieldAlert",
    actions: ["view", "create", "edit", "delete", "approve"],
    sortOrder: 42,
  },
  {
    code: "compliance_reports",
    name: "Compliance Reports",
    description: "ISM and regulatory reports",
    category: "compliance",
    icon: "FileCheck",
    actions: ["view", "create", "export"],
    sortOrder: 43,
  },

  // Analytics
  {
    code: "analytics_dashboard",
    name: "Analytics Dashboard",
    description: "Performance analytics and insights",
    category: "analytics",
    icon: "BarChart3",
    actions: ["view", "export"],
    sortOrder: 50,
  },
  {
    code: "predictive_maintenance",
    name: "Predictive Maintenance",
    description: "ML-based failure predictions",
    category: "analytics",
    icon: "BrainCircuit",
    actions: ["view", "manage_config", "override"],
    sortOrder: 51,
  },
  {
    code: "condition_monitoring",
    name: "Condition Monitoring",
    description: "Oil analysis and wear tracking",
    category: "analytics",
    icon: "Droplets",
    actions: ["view", "create", "edit", "delete"],
    sortOrder: 52,
  },
  {
    code: "ai_reports",
    name: "AI Reports",
    description: "AI-generated insights and reports",
    category: "analytics",
    icon: "Sparkles",
    actions: ["view", "create", "export"],
    sortOrder: 53,
  },
  {
    code: "cost_savings",
    name: "Cost Savings",
    description: "ROI and cost savings tracking",
    category: "analytics",
    icon: "PiggyBank",
    actions: ["view", "export"],
    sortOrder: 54,
  },

  // Settings
  {
    code: "organization_settings",
    name: "Organization Settings",
    description: "Organization configuration",
    category: "settings",
    icon: "Building",
    actions: ["view", "edit"],
    sortOrder: 60,
  },
  {
    code: "user_management",
    name: "User Management",
    description: "User accounts and roles",
    category: "settings",
    icon: "UserCog",
    actions: ["view", "create", "edit", "delete"],
    sortOrder: 61,
  },
  {
    code: "permission_management",
    name: "Permission Management",
    description: "Role and permission configuration",
    category: "settings",
    icon: "Shield",
    actions: ["view", "create", "edit", "delete"],
    sortOrder: 62,
  },
  {
    code: "system_settings",
    name: "System Settings",
    description: "System-wide configuration",
    category: "settings",
    icon: "Settings",
    actions: ["view", "edit", "manage_config"],
    sortOrder: 63,
  },
  {
    code: "integrations",
    name: "Integrations",
    description: "Third-party integrations",
    category: "settings",
    icon: "Plug",
    actions: ["view", "create", "edit", "delete", "manage_config"],
    sortOrder: 64,
  },
  {
    code: "audit_log",
    name: "Audit Log",
    description: "System audit trail",
    category: "settings",
    icon: "FileSearch",
    actions: ["view", "export"],
    sortOrder: 65,
  },
];

export const RESOURCE_CATEGORIES: { code: ResourceCategory; name: string; icon: string }[] = [
  { code: "operations", name: "Operations", icon: "Ship" },
  { code: "maintenance", name: "Maintenance", icon: "Wrench" },
  { code: "crew", name: "Crew", icon: "Users" },
  { code: "inventory", name: "Inventory", icon: "Package" },
  { code: "compliance", name: "Compliance", icon: "Shield" },
  { code: "analytics", name: "Analytics", icon: "BarChart3" },
  { code: "settings", name: "Settings", icon: "Settings" },
];

export function getResourceByCode(code: string): ResourceDefinition | undefined {
  return RESOURCES.find((r) => r.code === code);
}

export function getResourcesByCategory(category: ResourceCategory): ResourceDefinition[] {
  return RESOURCES.filter((r) => r.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getActionByCode(code: ActionCode): ActionDefinition {
  return ACTIONS[code];
}

export function getAllActions(): ActionDefinition[] {
  return Object.values(ACTIONS).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getActionsForResource(resourceCode: string): ActionDefinition[] {
  const resource = getResourceByCode(resourceCode);
  if (!resource) {
    return [];
  }
  return resource.actions.map((actionCode) => ACTIONS[actionCode]);
}
