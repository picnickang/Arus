/**
 * Crew Scheduler OR-Tools - Constraint Scheduling
 * CP-SAT style constraint satisfaction implementation
 */

import { CrewWithSkills, SelectShiftTemplate, SelectCrewLeave, SelectPortCall, SelectDrydockWindow, SelectCrewCertification } from "@shared/schema-runtime";
import { ScheduleResult, SchedulingPreferences, Assignment, UnfilledShift } from "./types.js";
import { shiftWindow, leaveOverlaps, isWindowAllowed, isNightShift, hasValidCertification } from "./helpers.js";

interface SchedulerState {
  scheduled: Assignment[];
  unfilled: UnfilledShift[];
  crewAssignments: { [crewId: string]: Assignment[] };
  nightShiftCounts: { [crewId: string]: number };
}

interface SchedulerConfig {
  weights: { unfilled: number; fairness: number; night_over: number; consec_night: number; pref_off: number; vessel_mismatch: number };
  rules: { max_nights_per_week: number };
  perCrewPrefs: { [crewId: string]: any };
}

function initializeConfig(preferences?: SchedulingPreferences): SchedulerConfig {
  return {
    weights: {
      unfilled: 1000, fairness: 20, night_over: 10,
      consec_night: 8, pref_off: 6, vessel_mismatch: 3,
      ...preferences?.weights,
    },
    rules: { max_nights_per_week: 4, ...preferences?.rules },
    perCrewPrefs: buildPerCrewPrefs(preferences),
  };
}

function buildPerCrewPrefs(preferences?: SchedulingPreferences): { [crewId: string]: any } {
  const perCrewPrefs: { [crewId: string]: any } = {};
  preferences?.per_crew?.forEach((pref) => {
    if (pref.crew_id) {perCrewPrefs[pref.crew_id] = pref;}
  });
  return perCrewPrefs;
}

function initializeState(crew: CrewWithSkills[]): SchedulerState {
  const state: SchedulerState = {
    scheduled: [],
    unfilled: [],
    crewAssignments: {},
    nightShiftCounts: {},
  };
  crew.forEach((c) => { state.crewAssignments[c.id] = []; state.nightShiftCounts[c.id] = 0; });
  return state;
}

function meetsRankRequirement(crewMember: CrewWithSkills, rankMin?: string): boolean {
  if (!rankMin || !crewMember.rank) {return true;}
  const rankOrder = ["Able Seaman", "Deck Officer", "Chief Officer", "Chief Engineer"];
  const crewRankIndex = rankOrder.indexOf(crewMember.rank);
  const minRankIndex = rankOrder.indexOf(rankMin);
  if (crewRankIndex === -1 || minRankIndex === -1) {return true;}
  return crewRankIndex >= minRankIndex;
}

function isCrewEligible(
  crewMember: CrewWithSkills,
  shift: SelectShiftTemplate,
  day: string,
  shiftStart: Date,
  shiftEnd: Date,
  isNight: boolean,
  state: SchedulerState,
  config: SchedulerConfig,
  leaves: SelectCrewLeave[],
  certifications: { [crewId: string]: SelectCrewCertification[] }
): boolean {
  if (leaveOverlaps(crewMember.id, shiftStart, shiftEnd, leaves)) {return false;}
  if (shift.requiredSkills && !crewMember.skills.includes(shift.requiredSkills)) {return false;}
  if (!meetsRankRequirement(crewMember, shift.rankMin)) {return false;}
  if (shift.certRequired && !hasValidCertification(crewMember, shift.certRequired, shiftStart, shiftEnd, certifications)) {return false;}
  if (state.scheduled.some((a) => a.date === day && a.crewId === crewMember.id)) {return false;}
  if (isNight && state.nightShiftCounts[crewMember.id] >= config.rules.max_nights_per_week) {return false;}
  return true;
}

function calculateCrewPenalty(
  crewMember: CrewWithSkills,
  day: string,
  vesselId: string,
  shiftDate: Date,
  isNight: boolean,
  state: SchedulerState,
  config: SchedulerConfig,
  crewCount: number
): number {
  let penalty = 0;
  const currentAssignments = state.crewAssignments[crewMember.id].length;
  const avgAssignments = Object.values(state.crewAssignments).reduce((s, a) => s + a.length, 0) / crewCount;
  penalty += Math.max(0, currentAssignments - avgAssignments) * config.weights.fairness;

  if (isNight) {
    const nightCount = state.nightShiftCounts[crewMember.id];
    if (nightCount >= config.rules.max_nights_per_week) {
      penalty += (nightCount - config.rules.max_nights_per_week + 1) * config.weights.night_over;
    }
    const yesterday = new Date(shiftDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const hadNightYesterday = state.scheduled.some((a) => a.date === yesterdayStr && a.crewId === crewMember.id && isNightShift(a.start.split("T")[1].split("Z")[0]));
    if (hadNightYesterday) {penalty += config.weights.consec_night;}
  }

  const crewPrefs = config.perCrewPrefs[crewMember.id];
  if (crewPrefs) {
    if (crewPrefs.days_off?.includes(day)) {penalty += config.weights.pref_off;}
    if (crewPrefs.prefer_vessel && vesselId && vesselId !== crewPrefs.prefer_vessel) {penalty += config.weights.vessel_mismatch;}
  }
  return penalty;
}

function determineShortageReason(shift: SelectShiftTemplate, eligibleCount: number): string {
  if (eligibleCount > 0) {return "insufficient eligible crew";}
  if (shift.requiredSkills) {return `no crew with required skill: ${shift.requiredSkills}`;}
  if (shift.certRequired) {return `no crew with required certification: ${shift.certRequired}`;}
  if (shift.rankMin) {return `no crew with minimum rank: ${shift.rankMin}`;}
  return "insufficient eligible crew";
}

export function scheduleWithConstraints(
  days: string[],
  shifts: SelectShiftTemplate[],
  crew: CrewWithSkills[],
  leaves: SelectCrewLeave[],
  portCalls: SelectPortCall[],
  drydocks: SelectDrydockWindow[],
  certifications: { [crewId: string]: SelectCrewCertification[] },
  preferences?: SchedulingPreferences
): ScheduleResult {
  const config = initializeConfig(preferences);
  const state = initializeState(crew);

  for (const day of days) {
    for (const shift of shifts) {
      const vesselId = shift.vesselId || "";
      const needed = shift.needed || 1;
      const shiftDate = new Date(`${day}T${shift.start}`);
      const isNight = isNightShift(shift.start);

      if (!isWindowAllowed(day, shift.start, shift.end, vesselId, portCalls, drydocks)) {
        state.unfilled.push({ day, shiftId: shift.id!, need: needed, reason: "vessel unavailable (drydock)" });
        continue;
      }

      const { start: shiftStart, end: shiftEnd } = shiftWindow(day, shift.start, shift.end);

      const eligibleCrew = crew.filter((crewMember) =>
        isCrewEligible(crewMember, shift, day, shiftStart, shiftEnd, isNight, state, config, leaves, certifications)
      );

      const scoredCrew = eligibleCrew
        .map((crewMember) => ({
          crewMember,
          penalty: calculateCrewPenalty(crewMember, day, vesselId, shiftDate, isNight, state, config, crew.length),
        }))
        .sort((a, b) => a.penalty - b.penalty);

      const assignedCount = Math.min(needed, scoredCrew.length);

      for (let i = 0; i < assignedCount; i++) {
        const { crewMember } = scoredCrew[i];
        const assignment: Assignment = {
          date: day, shiftId: shift.id!, crewId: crewMember.id, vesselId,
          start: new Date(`${day}T${shift.start}`).toISOString(),
          end: new Date(`${day}T${shift.end}`).toISOString(),
          role: shift.role,
        };
        state.scheduled.push(assignment);
        state.crewAssignments[crewMember.id].push(assignment);
        if (isNight) {state.nightShiftCounts[crewMember.id]++;}
      }

      const shortage = needed - assignedCount;
      if (shortage > 0) {
        state.unfilled.push({ day, shiftId: shift.id!, need: shortage, reason: determineShortageReason(shift, eligibleCrew.length) });
      }
    }
  }

  return { scheduled: state.scheduled, unfilled: state.unfilled };
}
