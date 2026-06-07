# Vessel Intelligence v2 Route To Frame Map

| Route                                                         | Primary frame                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `/vessel-intelligence`                                        | `desktop/01_desktop_fleet_triage_overview.svg`             |
| `/vessel-intelligence/fleet`                                  | `desktop/01_desktop_fleet_triage_overview.svg`             |
| `/vessel-intelligence/:vesselId/overview`                     | `desktop/02_desktop_digital_twin_home_operational.svg`     |
| `/vessel-intelligence/:vesselId/sections`                     | `desktop/03_desktop_sectioned_vessel_map_equipment.svg`    |
| `/vessel-intelligence/:vesselId/sections/:sectionId`          | `desktop/04_desktop_section_detail_multiple_equipment.svg` |
| `/vessel-intelligence/:vesselId/equipment/:equipmentId`       | `desktop/04_desktop_section_detail_multiple_equipment.svg` |
| `/vessel-intelligence/:vesselId/maintenance`                  | `desktop/05_desktop_maintenance_work_orders.svg`           |
| `/vessel-intelligence/:vesselId/maintenance/:workOrderId`     | `desktop/06_desktop_work_order_detail_evidence.svg`        |
| `/vessel-intelligence/:vesselId/alerts`                       | `desktop/07_desktop_alerts_insights_expert_cases.svg`      |
| `/vessel-intelligence/:vesselId/expert-cases`                 | `desktop/07_desktop_alerts_insights_expert_cases.svg`      |
| `/vessel-intelligence/:vesselId/performance`                  | `desktop/08_desktop_performance_health_analytics.svg`      |
| `/vessel-intelligence/:vesselId/health`                       | `desktop/08_desktop_performance_health_analytics.svg`      |
| `/vessel-intelligence/:vesselId/reports`                      | `desktop/09_desktop_reports_library.svg`                   |
| `/vessel-intelligence/:vesselId/diagrams`                     | `desktop/10_desktop_diagram_manager.svg`                   |
| `/vessel-intelligence/:vesselId/diagrams/:diagramId`          | `desktop/15_desktop_version_history_rollback.svg`          |
| `/vessel-intelligence/:vesselId/diagrams/:diagramId/versions` | `desktop/15_desktop_version_history_rollback.svg`          |
| `/vessel-intelligence/:vesselId/section-maps/:mapId/edit`     | `desktop/12_desktop_section_map_editor.svg`                |
| `/vessel-intelligence/:vesselId/section-maps/:mapId/validate` | `desktop/16_desktop_publish_validation_permissions.svg`    |
| `/vessel-intelligence/:vesselId/thumbnails`                   | `desktop/14_desktop_thumbnail_managers.svg`                |
| `/vessel-intelligence/:vesselId/settings`                     | `desktop/17_desktop_import_export_clone_templates.svg`     |

Mobile breakpoints use the matching `mobile/*` frames for overview, section map, section detail, maintenance, alerts, expert cases, reports, settings/thumbnails, and offline/stale states.
