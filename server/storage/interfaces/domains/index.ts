/**
 * Storage Interface Domains - Combined IStorage Interface
 * 
 * This file combines all domain-specific storage interfaces into
 * the complete IStorage interface using TypeScript intersection types.
 * 
 * Module Structure:
 * - core.types.ts (~45 lines) - Organizations, Users, Settings
 * - device.types.ts (~75 lines) - Devices, Heartbeats, Registry
 * - telemetry.types.ts (~35 lines) - Telemetry Readings, Trends
 * - work-order.types.ts (~110 lines) - Work Orders, Tasks, Parts
 * - equipment.types.ts (~75 lines) - Equipment, Lifecycle, Parameters
 * - maintenance.types.ts (~100 lines) - Schedules, Records, Templates
 * - alerts.types.ts (~60 lines) - Alerts, Notifications, Suppressions
 * - sensor.types.ts (~60 lines) - Sensors, J1939, DTCs
 * - inventory.types.ts (~50 lines) - Parts, Stock Management
 * - crew.types.ts (~110 lines) - Crew, Skills, Certifications, Rest
 * - vessel.types.ts (~50 lines) - Vessels, Port Calls, Drydocks
 * - ml.types.ts (~60 lines) - ML Models, Predictions, RUL
 * - compliance.types.ts (~75 lines) - Audit, Findings, DSAR
 * - analytics.types.ts (~85 lines) - Insights, Knowledge Base, Optimizer
 * - condition-monitoring.types.ts (~100 lines) - Oil, Vibration, Wear
 * - logbook.types.ts (~115 lines) - Deck/Engine Logs, Events
 * - admin.types.ts (~90 lines) - Audit, Sessions, Health
 * - scheduling.types.ts (~35 lines) - Scheduler, Assignments
 * - external.types.ts (~40 lines) - StormGeo Integration
 */

// Domain interfaces
export type { ICoreStorage } from "./core.types";
export type { IDeviceStorage } from "./device.types";
export type { ITelemetryStorage } from "./telemetry.types";
export type { IWorkOrderStorage, WorkOrderFilters } from "./work-order.types";
export type { IEquipmentStorage } from "./equipment.types";
export type { IMaintenanceStorage } from "./maintenance.types";
export type { IAlertsStorage } from "./alerts.types";
export type { ISensorStorage } from "./sensor.types";
export type { IInventoryStorage } from "./inventory.types";
export type { ICrewStorage } from "./crew.types";
export type { IVesselStorage } from "./vessel.types";
export type { IMlStorage } from "./ml.types";
export type { IComplianceStorage } from "./compliance.types";
export type { IAnalyticsStorage } from "./analytics.types";
export type { IConditionMonitoringStorage } from "./condition-monitoring.types";
export type { ILogbookStorage } from "./logbook.types";
export type { IAdminStorage } from "./admin.types";
export type { ISchedulingStorage } from "./scheduling.types";
export type { IExternalStorage } from "./external.types";

import type { ICoreStorage } from "./core.types";
import type { IDeviceStorage } from "./device.types";
import type { ITelemetryStorage } from "./telemetry.types";
import type { IWorkOrderStorage } from "./work-order.types";
import type { IEquipmentStorage } from "./equipment.types";
import type { IMaintenanceStorage } from "./maintenance.types";
import type { IAlertsStorage } from "./alerts.types";
import type { ISensorStorage } from "./sensor.types";
import type { IInventoryStorage } from "./inventory.types";
import type { ICrewStorage } from "./crew.types";
import type { IVesselStorage } from "./vessel.types";
import type { IMlStorage } from "./ml.types";
import type { IComplianceStorage } from "./compliance.types";
import type { IAnalyticsStorage } from "./analytics.types";
import type { IConditionMonitoringStorage } from "./condition-monitoring.types";
import type { ILogbookStorage } from "./logbook.types";
import type { IAdminStorage } from "./admin.types";
import type { ISchedulingStorage } from "./scheduling.types";
import type { IExternalStorage } from "./external.types";

/**
 * @deprecated IStorage is a legacy god-object interface. New code should import
 * domain repositories directly from server/repositories.ts instead. This interface
 * is retained only for existing service-layer consumers (~50 files) that have not
 * yet been migrated. No new code should depend on IStorage.
 */
export type IStorage =
  ICoreStorage &
  IDeviceStorage &
  ITelemetryStorage &
  IWorkOrderStorage &
  IEquipmentStorage &
  IMaintenanceStorage &
  IAlertsStorage &
  ISensorStorage &
  IInventoryStorage &
  ICrewStorage &
  IVesselStorage &
  IMlStorage &
  IComplianceStorage &
  IAnalyticsStorage &
  IConditionMonitoringStorage &
  ILogbookStorage &
  IAdminStorage &
  ISchedulingStorage &
  IExternalStorage;
