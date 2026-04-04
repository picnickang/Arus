export const OSV_ROLES = {
  chief_engineer: {
    id: "chief_engineer",
    label: "Chief Engineer",
    description: "Equipment health, PdM alerts, EFMS fuel data, DP systems",
    icon: "Wrench",
    quickActions: [
      { label: "New Work Order", icon: "ClipboardCheck", href: "/work-orders?action=create" },
      { label: "Log Engine Entry", icon: "BookOpen", href: "/engine-logbook?action=new" },
      { label: "EFMS Dashboard", icon: "Fuel", href: "/analytics?tab=fuel-monitoring" },
      { label: "PdM Alerts", icon: "Activity", href: "/pdm-dashboard" },
    ],
    pinnedGroups: ["maintenance", "operations", "fleet"],
    bottomNav: ["home", "operations", "maintenance", "fleet", "more"],
  },

  dpo: {
    id: "dpo",
    label: "DP Operator",
    description: "DP status, daily checks, incident reports, operations log",
    icon: "Navigation",
    quickActions: [
      { label: "DP Daily Check", icon: "ClipboardCheck", href: "/dp/daily-checks?action=new" },
      { label: "Log Operation", icon: "BookOpen", href: "/offshore-ops?action=new" },
      { label: "Report DP Incident", icon: "AlertTriangle", href: "/dp/incidents?action=new" },
      { label: "Vessel Position", icon: "Compass", href: "/vessel-track-log" },
    ],
    pinnedGroups: ["operations", "records", "fleet"],
    bottomNav: ["home", "operations", "records", "fleet", "more"],
  },

  deck_officer: {
    id: "deck_officer",
    label: "Deck Officer / Master",
    description: "Cargo ops, vetting readiness, charter KPIs, crew hours",
    icon: "Anchor",
    quickActions: [
      { label: "Log Cargo Op", icon: "Package", href: "/offshore-ops?action=new&type=cargo_transfer" },
      { label: "Record Rest Hours", icon: "Clock", href: "/hours-of-rest?action=record" },
      { label: "Vetting Status", icon: "Shield", href: "/vetting" },
      { label: "Charter KPIs", icon: "BarChart3", href: "/charter" },
    ],
    pinnedGroups: ["operations", "records", "crew"],
    bottomNav: ["home", "operations", "crew", "records", "more"],
  },

  shore_superintendent: {
    id: "shore_superintendent",
    label: "Shore Superintendent",
    description: "Fleet health, charter compliance, vetting, analytics",
    icon: "BarChart3",
    quickActions: [
      { label: "Fleet Dashboard", icon: "Gauge", href: "/dashboard" },
      { label: "Charter Overview", icon: "BarChart3", href: "/charter/fleet-overview" },
      { label: "Vetting Readiness", icon: "Shield", href: "/vetting/fleet-readiness" },
      { label: "DP Fleet Status", icon: "Navigation", href: "/dp/summary" },
    ],
    pinnedGroups: ["operations", "analytics", "fleet"],
    bottomNav: ["home", "operations", "analytics", "fleet", "more"],
  },

  system_admin: {
    id: "system_admin",
    label: "System Admin",
    description: "Diagnostics, EFMS config, sensors, user management",
    icon: "Settings",
    quickActions: [
      { label: "Diagnostics", icon: "Activity", href: "/diagnostics" },
      { label: "EFMS Config", icon: "Fuel", href: "/sensors?tab=efms" },
      { label: "Sensor Calibration", icon: "Activity", href: "/sensors/calibration" },
      { label: "SHIPMATE Import", icon: "Package", href: "/import/shipmate" },
    ],
    pinnedGroups: ["system", "analytics", "operations"],
    bottomNav: ["home", "system", "analytics", "operations", "more"],
  },
};

export const OSV_NAV_ITEMS = {
  operations: [
    { name: "DP Systems", href: "/dp", icon: "Navigation", description: "DP status, checks & incidents" },
    { name: "Offshore Operations", href: "/offshore-ops", icon: "Ship", description: "Cargo, anchor handling, SPM" },
    { name: "Charter Compliance", href: "/charter", icon: "BarChart3", description: "KPIs vs charter targets" },
  ],
  fleet: [
    { name: "Vetting Status", href: "/vetting", icon: "Shield", description: "OVID/SIRE readiness" },
  ],
  system: [
    { name: "EFMS Configuration", href: "/sensors?tab=efms", icon: "Fuel", description: "Fuel monitoring setup" },
    { name: "SHIPMATE Import", href: "/import/shipmate", icon: "Package", description: "Import from SHIPMATE" },
  ],
};
