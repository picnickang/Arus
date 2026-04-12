/**
 * Scheduling Job Processors
 */

export async function processCrewScheduling(data: {
  days: string[];
  shifts: any[];
  crew: any[];
  leaves: any[];
  options: any;
}): Promise<any> {
  const { scheduleWithORTools } = await import("../crew-scheduler-ortools");
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
  const { storage } = await import("../repositories");
  return storage.autoScheduleMaintenance(data.equipmentId, data.pdmScore);
}
