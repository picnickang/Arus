/**
 * Scheduling Job Processors
 */

import { planWithEngine } from "../crew-scheduler-ortools/scheduler.js";
import { ENGINE_OR_TOOLS } from "../crew-scheduler-ortools/types.js";
import type {
  SelectShiftTemplate,
  SelectCrewLeave,
  SelectCrewCertification,
  CrewWithSkills,
  SchedulingPreferences,
  ScheduleResult,
} from "../crew-scheduler-ortools/types.js";
import { dbMaintenanceStorage } from "../repositories";

export async function processCrewScheduling(data: {
  days: string[];
  shifts: SelectShiftTemplate[];
  crew: CrewWithSkills[];
  leaves: SelectCrewLeave[];
  options: { preferences?: SchedulingPreferences };
}): Promise<ScheduleResult> {
  return planWithEngine({
    engine: ENGINE_OR_TOOLS,
    days: data.days,
    shifts: data.shifts,
    crew: data.crew,
    leaves: data.leaves,
    portCalls: [],
    drydocks: [],
    certifications: {} as { [crewId: string]: SelectCrewCertification[] },
    preferences: data.options.preferences,
  });
}

export async function processMaintenanceScheduling(data: {
  equipmentId: string;
  pdmScore: number;
}): Promise<unknown> {
  return (
    dbMaintenanceStorage as object as {
      autoScheduleMaintenance: (equipmentId: string, pdmScore: number) => Promise<unknown>;
    }
  ).autoScheduleMaintenance(data.equipmentId, data.pdmScore);
}
