/**
 * ARUS Storage Interface Types
 *
 * BACKWARD COMPATIBILITY SHIM
 *
 * This file maintains backward compatibility by re-exporting all types
 * from the modularized domain files in ./domains/
 *
 * The IStorage interface has been split into 19 domain-specific interfaces:
 * - ICoreStorage: Organizations, Users, Settings (~45 lines)
 * - IDeviceStorage: Devices, Heartbeats, Registry (~75 lines)
 * - ITelemetryStorage: Telemetry Readings, Trends (~35 lines)
 * - IWorkOrderStorage: Work Orders, Tasks, Parts (~110 lines)
 * - IEquipmentStorage: Equipment, Lifecycle, Parameters (~75 lines)
 * - IMaintenanceStorage: Schedules, Records, Templates (~100 lines)
 * - IAlertsStorage: Alerts, Notifications, Suppressions (~60 lines)
 * - ISensorStorage: Sensors, J1939, DTCs (~60 lines)
 * - IInventoryStorage: Parts, Stock Management (~50 lines)
 * - ICrewStorage: Crew, Skills, Certifications, Rest (~110 lines)
 * - IVesselStorage: Vessels, Port Calls, Drydocks (~50 lines)
 * - IMlStorage: ML Models, Predictions, RUL (~60 lines)
 * - IComplianceStorage: Audit, Findings, DSAR (~75 lines)
 * - IAnalyticsStorage: Insights, Knowledge Base, Optimizer (~85 lines)
 * - IConditionMonitoringStorage: Oil, Vibration, Wear (~100 lines)
 * - ILogbookStorage: Deck/Engine Logs, Events (~115 lines)
 * - IAdminStorage: Audit, Sessions, Health (~90 lines)
 * - ISchedulingStorage: Scheduler, Assignments (~35 lines)
 * - IExternalStorage: StormGeo Integration (~40 lines)
 *
 * Original file: 897 lines → 19 modules (avg ~60 lines each, max ~115 lines)
 */

// Re-export the combined IStorage interface (the only consumed surface).
export type { IStorage } from "./domains";
