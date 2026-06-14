/**
 * Scheduling Domain - Ports
 *
 * - ISchedulingMaintenancePort is hand-defined (NOT derived from the maintenance
 *   storage type): that storage belongs to another domain, so naming it anywhere
 *   under domains/scheduling would re-introduce the cross-domain leak. Its
 *   concrete adapter lives in composition/.
 * - IOptimizerRepository is the scheduling domain's own optimization storage,
 *   so it is derived structurally from the optimizer storage and implemented in
 *   infrastructure/.
 */

import type { WidenPartial } from "../../../lib/widen-partial";
import type { dbOptimizerStorage } from "../../../db/optimizer/index.js";
import type {
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  ScheduleQueryFilters,
} from "./types";

/** Cross-domain access to maintenance schedules (impl in composition/). */
export interface ISchedulingMaintenancePort {
  getMaintenanceSchedules(
    equipmentId?: string,
    orgId?: string,
    filters?: ScheduleQueryFilters
  ): Promise<MaintenanceSchedule[]>;
  getMaintenanceSchedule(id: string, orgId?: string): Promise<MaintenanceSchedule | undefined>;
  createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule>;
  updateMaintenanceSchedule(
    id: string,
    updates: WidenPartial<InsertMaintenanceSchedule>,
    orgId?: string
  ): Promise<MaintenanceSchedule>;
  deleteMaintenanceSchedule(id: string, orgId?: string): Promise<void>;
}

/** Optimization persistence (the scheduling domain's own storage). */
export type IOptimizerRepository = Pick<
  typeof dbOptimizerStorage,
  | "getOptimizerConfigurations"
  | "createOptimizerConfiguration"
  | "getOptimizationResults"
  | "createOptimizationResult"
>;

/** Cross-domain registry reads for the optimization dashboard (impl in composition/). */
export interface IOptimizationDirectoryPort {
  listEquipmentRegistry(orgId: string): Promise<unknown[]>;
  listVessels(orgId: string): Promise<unknown[]>;
}
