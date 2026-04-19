/**
 * Scheduling Job Processors
 */

import { scheduleWithORTools } from "../crew-scheduler-ortools";
import { storage } from "../repositories";

export async function processCrewScheduling(data: {
  days: string[];
  shifts: any[];
  crew: any[];
  leaves: any[];
  options: any;
}): Promise<any> {
  return scheduleWithORTools(
    data.days,
    data.shifts,
    data.crew,
    data.leaves,
    [],
    [],
    {},
    data.options.preferences
  );
}

export async function processMaintenanceScheduling(data: {
  equipmentId: string;
  pdmScore: number;
}): Promise<any> {
  return storage.autoScheduleMaintenance(data.equipmentId, data.pdmScore);
}
