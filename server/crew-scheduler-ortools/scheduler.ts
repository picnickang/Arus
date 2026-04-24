/**
 * Crew Scheduler OR-Tools - Main Scheduler
 * Engine selection and greedy fallback
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("CrewSchedulerOrtools:Scheduler");
import { planShifts as greedyPlan } from "../crew-scheduler";
import {
  ScheduleResult,
  ConstraintScheduleRequest,
  SchedulingPreferences,
  ENGINE_OR_TOOLS,
  type CrewWithSkills,
  type SelectShiftTemplate,
  type SelectCrewLeave,
  type SelectPortCall,
  type SelectDrydockWindow,
  type SelectCrewCertification,
} from "./types.js";
import { isWindowAllowed } from "./helpers.js";
import { scheduleWithConstraints } from "./constraint-scheduler.js";

function scheduleWithORTools(
  days: string[],
  shifts: SelectShiftTemplate[],
  crew: CrewWithSkills[],
  leaves: SelectCrewLeave[],
  portCalls: SelectPortCall[],
  drydocks: SelectDrydockWindow[],
  certifications: { [crewId: string]: SelectCrewCertification[] },
  preferences?: SchedulingPreferences
): ScheduleResult {
  try {
    return scheduleWithConstraints(
      days,
      shifts,
      crew,
      leaves,
      portCalls,
      drydocks,
      certifications,
      preferences
    );
  } catch (error) {
    logger.warn("Constraint scheduling failed, falling back to greedy scheduler:", { details: error instanceof Error ? error.message : String(error) });
    return scheduleWithGreedy(
      days,
      shifts,
      crew,
      leaves,
      portCalls,
      drydocks,
      certifications,
      preferences
    );
  }
}

function scheduleWithGreedy(
  days: string[],
  shifts: SelectShiftTemplate[],
  crew: CrewWithSkills[],
  leaves: SelectCrewLeave[],
  portCalls: SelectPortCall[],
  drydocks: SelectDrydockWindow[],
  certifications: { [crewId: string]: SelectCrewCertification[] },
  preferences?: SchedulingPreferences
): ScheduleResult {
  const availableShifts = shifts.filter((shift) => {
    const vesselId = shift.vesselId || "";
    return days.some((day) =>
      isWindowAllowed(day, shift.start, shift.end, vesselId, portCalls, drydocks)
    );
  });

  const enhancedCrew = crew.map((crewMember) => ({
    ...crewMember,
    certifications: certifications[crewMember.id] ?? [],
  }));

  return greedyPlan(days, availableShifts, enhancedCrew, leaves, []);
}

export function planWithEngine(request: ConstraintScheduleRequest): ScheduleResult {
  const { engine, days, shifts, crew, leaves, portCalls, drydocks, certifications, preferences } =
    request;

  if (engine === ENGINE_OR_TOOLS) {
    return scheduleWithORTools(
      days,
      shifts,
      crew,
      leaves,
      portCalls,
      drydocks,
      certifications,
      preferences
    );
  }
  return scheduleWithGreedy(
    days,
    shifts,
    crew,
    leaves,
    portCalls,
    drydocks,
    certifications,
    preferences
  );
}
