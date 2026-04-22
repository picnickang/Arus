/**
 * Default Schedule Generator Strategy
 * Implements balanced scheduling algorithm for SIMULATE mode
 * Uses injected ports for data access (proper hexagonal architecture)
 */

import { v4 as uuidv4 } from "uuid";
import type {
  IScheduleGeneratorStrategy,
  ICrewDataPort,
  IVesselDataPort,
} from "../domain/ports.js";
import type {
  ScheduleAssignmentEntity,
  ProposedAssignment,
  SimulationUnfilledShift,
} from "../domain/types.js";
import { createLogger } from "../../../lib/structured-logger.js";

const logger = createLogger("ScheduleGenerator");

interface GeneratorParams {
  orgId: string;
  fromDate: Date;
  toDate: Date;
  vesselIds?: string[];
  crewIds?: string[];
  existingAssignments: ScheduleAssignmentEntity[];
}

interface GeneratorResult {
  proposedAssignments: ProposedAssignment[];
  unfilledShifts: SimulationUnfilledShift[];
}

interface CrewData {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface VesselData {
  id: string;
  name: string;
  type: string;
  status: string;
}

export class BalancedScheduleGenerator implements IScheduleGeneratorStrategy {
  constructor(
    private crewDataPort: ICrewDataPort,
    private vesselDataPort: IVesselDataPort
  ) {}

  async generate(params: GeneratorParams): Promise<GeneratorResult> {
    const { orgId, fromDate, toDate, vesselIds, crewIds, existingAssignments } = params;

    const vesselList = await this.vesselDataPort.findByOrgId(orgId, vesselIds);
    const crewList = await this.crewDataPort.findByOrgId(orgId, crewIds);

    const proposedAssignments: ProposedAssignment[] = [];
    const unfilledShifts: SimulationUnfilledShift[] = [];

    const existingByDate = this.groupAssignmentsByDate(existingAssignments);
    const crewHoursMap = new Map<string, number>();

    for (const assignment of existingAssignments) {
      const hours = this.getShiftHours(assignment.shift);
      crewHoursMap.set(assignment.crewId, (crewHoursMap.get(assignment.crewId) || 0) + hours);
    }

    const dateRange = this.getDateRange(fromDate, toDate);

    for (const date of dateRange) {
      const dateStr = this.formatDate(date);
      const existingForDate = existingByDate.get(dateStr) || [];

      for (const vessel of vesselList) {
        for (const shift of ["day", "night"] as const) {
          const hasExisting = existingForDate.some(
            (a) => a.vesselId === vessel.id && a.shift === shift
          );

          if (hasExisting) {
            continue;
          }

          const availableCrew = crewList.filter((crew) => {
            const alreadyAssigned = existingForDate.some((a) => a.crewId === crew.id);
            const weeklyHours = crewHoursMap.get(crew.id) || 0;
            return !alreadyAssigned && weeklyHours < 72;
          });

          availableCrew.sort((a, b) => {
            const hoursA = crewHoursMap.get(a.id) || 0;
            const hoursB = crewHoursMap.get(b.id) || 0;
            return hoursA - hoursB;
          });

          if (availableCrew.length > 0) {
            const selected = availableCrew[0];
            const shiftHours = this.getShiftHours(shift);

            proposedAssignments.push({
              tempId: uuidv4(),
              crewId: selected.id,
              crewName: selected.name,
              vesselId: vessel.id,
              vesselName: vessel.name,
              date: dateStr,
              shift,
              role: selected.role || null,
              changeType: "add",
              confidence: this.calculateConfidence(selected, vessel, shift),
              reason: `Balanced assignment based on crew availability and hours`,
            });

            crewHoursMap.set(selected.id, (crewHoursMap.get(selected.id) || 0) + shiftHours);
          } else {
            unfilledShifts.push({
              date: dateStr,
              shift,
              vesselId: vessel.id,
              vesselName: vessel.name,
              role: null,
              reason: "No available crew with capacity",
              alternativeCrew: crewList.slice(0, 3).map((c) => c.id),
            });
          }
        }
      }
    }

    logger.info("[BalancedScheduleGenerator] Generated schedule", {
      orgId,
      dateRange: { from: this.formatDate(fromDate), to: this.formatDate(toDate) },
      proposedCount: proposedAssignments.length,
      unfilledCount: unfilledShifts.length,
    });

    return { proposedAssignments, unfilledShifts };
  }

  private groupAssignmentsByDate(
    assignments: ScheduleAssignmentEntity[]
  ): Map<string, ScheduleAssignmentEntity[]> {
    const map = new Map<string, ScheduleAssignmentEntity[]>();
    for (const a of assignments) {
      const dateStr = this.formatDate(a.date);
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(a);
    }
    return map;
  }

  private getDateRange(from: Date, to: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(from);
    while (current <= to) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private getShiftHours(shift: "day" | "night" | "full_day"): number {
    switch (shift) {
      case "day":
        return 8;
      case "night":
        return 8;
      case "full_day":
        return 12;
      default:
        return 8;
    }
  }

  private calculateConfidence(crew: CrewData, vessel: VesselData, shift: "day" | "night"): number {
    let confidence = 0.7;
    if (crew.role) {
      confidence += 0.1;
    }
    if (shift === "day") {
      confidence += 0.05;
    }
    return Math.min(confidence, 0.95);
  }
}
