// Map route paths to permission resources
// Resource codes must match server/config/permission-registry.ts exactly
export const routeResourceMap: Record<string, string> = {
  // Operations
  "/findings": "dashboard",
  "/briefing": "dashboard",
  "/attention-inbox": "dashboard",
  "/feedback-review": "dashboard",
  "/offline-outbox": "dashboard",
  "/alerts": "alerts",
  "/governance-dashboard": "compliance_reports",
  "/diagnostics": "system_settings",

  // Fleet
  "/vessel-intelligence": "vessels",
  "/vessel-intelligence/fleet": "vessels",
  "/vessel-intelligence/:vesselId/overview": "vessels",
  "/vessel-intelligence/:vesselId/sections": "vessels",
  "/vessel-intelligence/:vesselId/sections/:sectionId": "vessels",
  "/vessel-intelligence/:vesselId/equipment/:equipmentId": "vessels",
  "/vessel-intelligence/:vesselId/performance": "predictive_maintenance",
  "/vessel-intelligence/:vesselId/health": "predictive_maintenance",
  "/vessel-intelligence/:vesselId/alerts": "alerts",
  "/vessel-intelligence/:vesselId/maintenance": "work_orders",
  "/vessel-intelligence/:vesselId/maintenance/:workOrderId": "work_orders",
  "/vessel-intelligence/:vesselId/expert-cases": "dashboard",
  "/vessel-intelligence/:vesselId/reports": "compliance_reports",
  "/vessel-intelligence/:vesselId/settings": "vessels",
  "/vessel-intelligence/:vesselId/diagrams": "vessels",
  "/vessel-intelligence/:vesselId/diagrams/:diagramId": "vessels",
  "/vessel-intelligence/:vesselId/diagrams/:diagramId/versions": "vessels",
  "/vessel-intelligence/:vesselId/section-maps/:mapId/edit": "vessels",
  "/vessel-intelligence/:vesselId/section-maps/:mapId/validate": "vessels",
  "/vessel-intelligence/:vesselId/thumbnails": "vessels",
  "/fleet": "vessels",
  "/fleet-overview": "vessels",
  "/fleet/:vesselId": "vessels",
  "/vessel-management": "vessels",
  "/equipment": "vessels",
  "/equipment-schematic/:vesselId": "vessels",
  "/equipment-scan": "vessels",
  "/reports/vessel/:vesselId": "compliance_reports",
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
