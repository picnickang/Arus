import type { ConstraintViolation, SchedulingPreferences } from "./types";

export interface ConstraintCheckContext {
  crewId: string;
  crewName?: string;
  date: string;
  shiftStart: Date;
  shiftEnd: Date;
  existingAssignments: Array<{ start: Date; end: Date; crewId: string }>;
  leaveRecords: Array<{ crewId: string; start: Date; end: Date }>;
  certifications: Array<{ crewId: string; cert: string; expiresAt: Date }>;
  preferences: SchedulingPreferences;
}

export function checkRestHoursConstraint(
  context: ConstraintCheckContext,
  lastShiftEnd: Date | null
): ConstraintViolation | null {
  if (!lastShiftEnd) {return null;}

  const restHours = (context.shiftStart.getTime() - lastShiftEnd.getTime()) / (1000 * 60 * 60);
  const required = context.preferences.rules.minRestHours;
  const enforcement = context.preferences.ruleEnforcement.minRestHours;

  if (restHours < required) {
    return {
      constraint: {
        type: "rest_hours",
        enforcement,
        threshold: required,
        description: `Minimum ${required}h rest between shifts`,
      },
      crewId: context.crewId,
      crewName: context.crewName,
      date: context.date,
      description: `Only ${restHours.toFixed(1)}h rest (required: ${required}h)`,
      severity: enforcement === "hard" ? "error" : "warning",
      details: { actualRest: restHours, required },
    };
  }

  return null;
}

export function checkMaxWeeklyHoursConstraint(
  context: ConstraintCheckContext,
  weeklyHours: number,
  shiftDuration: number,
  maxWeekly = 72
): ConstraintViolation | null {
  const projected = weeklyHours + shiftDuration;

  if (projected > maxWeekly) {
    return {
      constraint: {
        type: "max_weekly",
        enforcement: "hard",
        threshold: maxWeekly,
        description: `Maximum ${maxWeekly}h per 7 days (STCW)`,
      },
      crewId: context.crewId,
      crewName: context.crewName,
      date: context.date,
      description: `Would exceed weekly hours (${projected.toFixed(1)}h / ${maxWeekly}h max)`,
      severity: "error",
      details: { currentHours: weeklyHours, shiftDuration, projected, max: maxWeekly },
    };
  }

  return null;
}

export function checkLeaveConstraint(context: ConstraintCheckContext): ConstraintViolation | null {
  const crewLeave = context.leaveRecords.filter((l) => l.crewId === context.crewId);

  for (const leave of crewLeave) {
    if (context.shiftStart < leave.end && context.shiftEnd > leave.start) {
      return {
        constraint: {
          type: "leave",
          enforcement: "hard",
          description: "Crew member is on leave",
        },
        crewId: context.crewId,
        crewName: context.crewName,
        date: context.date,
        description: "On approved leave during this period",
        severity: "error",
        details: { leaveStart: leave.start.toISOString(), leaveEnd: leave.end.toISOString() },
      };
    }
  }

  return null;
}

export function checkCertificationConstraint(
  context: ConstraintCheckContext,
  requiredCert: string | null
): ConstraintViolation | null {
  if (!requiredCert) {return null;}

  const crewCerts = context.certifications.filter((c) => c.crewId === context.crewId);
  const matchingCert = crewCerts.find((c) => c.cert === requiredCert);

  if (!matchingCert) {
    return {
      constraint: {
        type: "certification",
        enforcement: "hard",
        description: `Requires ${requiredCert} certification`,
      },
      crewId: context.crewId,
      crewName: context.crewName,
      date: context.date,
      description: `Missing required certification: ${requiredCert}`,
      severity: "error",
    };
  }

  if (matchingCert.expiresAt < context.shiftEnd) {
    return {
      constraint: {
        type: "certification",
        enforcement: "hard",
        description: `${requiredCert} expires before shift ends`,
      },
      crewId: context.crewId,
      crewName: context.crewName,
      date: context.date,
      description: `Certification ${requiredCert} expires on ${matchingCert.expiresAt.toISOString().split("T")[0]}`,
      severity: "error",
      details: { expiresAt: matchingCert.expiresAt.toISOString() },
    };
  }

  const warningDays = context.preferences.rules.certExpiryWarningDays;
  const warningDate = new Date(context.shiftEnd);
  warningDate.setDate(warningDate.getDate() + warningDays);

  if (matchingCert.expiresAt < warningDate) {
    const enforcement = context.preferences.ruleEnforcement.certExpiryWarning;
    return {
      constraint: {
        type: "certification",
        enforcement,
        threshold: warningDays,
        description: `${requiredCert} expires within ${warningDays} days`,
      },
      crewId: context.crewId,
      crewName: context.crewName,
      date: context.date,
      description: `Certification ${requiredCert} expires in ${Math.ceil((matchingCert.expiresAt.getTime() - context.shiftEnd.getTime()) / (1000 * 60 * 60 * 24))} days`,
      severity: enforcement === "hard" ? "error" : "warning",
      details: { expiresAt: matchingCert.expiresAt.toISOString(), warningDays },
    };
  }

  return null;
}

export function checkOverlapConstraint(context: ConstraintCheckContext): ConstraintViolation | null {
  const bufferHours = context.preferences.rules.overlapBufferHours;
  const enforcement = context.preferences.ruleEnforcement.overlapBuffer;
  const bufferMs = bufferHours * 60 * 60 * 1000;

  const crewAssignments = context.existingAssignments.filter((a) => a.crewId === context.crewId);

  for (const assignment of crewAssignments) {
    const adjustedStart = new Date(context.shiftStart.getTime() - bufferMs);
    const adjustedEnd = new Date(context.shiftEnd.getTime() + bufferMs);

    if (adjustedStart < assignment.end && adjustedEnd > assignment.start) {
      return {
        constraint: {
          type: "overlap",
          enforcement,
          threshold: bufferHours,
          description: `${bufferHours}h buffer between shifts`,
        },
        crewId: context.crewId,
        crewName: context.crewName,
        date: context.date,
        description: `Overlaps with existing assignment (${bufferHours}h buffer required)`,
        severity: enforcement === "hard" ? "error" : "warning",
        details: {
          existingStart: assignment.start.toISOString(),
          existingEnd: assignment.end.toISOString(),
        },
      };
    }
  }

  return null;
}

export function checkAllConstraints(
  context: ConstraintCheckContext,
  lastShiftEnd: Date | null,
  weeklyHours: number,
  shiftDuration: number,
  requiredCert: string | null,
  maxWeekly = 72
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const restViolation = checkRestHoursConstraint(context, lastShiftEnd);
  if (restViolation) {violations.push(restViolation);}

  const weeklyViolation = checkMaxWeeklyHoursConstraint(context, weeklyHours, shiftDuration, maxWeekly);
  if (weeklyViolation) {violations.push(weeklyViolation);}

  const leaveViolation = checkLeaveConstraint(context);
  if (leaveViolation) {violations.push(leaveViolation);}

  const certViolation = checkCertificationConstraint(context, requiredCert);
  if (certViolation) {violations.push(certViolation);}

  const overlapViolation = checkOverlapConstraint(context);
  if (overlapViolation) {violations.push(overlapViolation);}

  return violations;
}

export function hasHardViolation(violations: ConstraintViolation[]): boolean {
  return violations.some((v) => v.severity === "error");
}

export function filterSoftViolations(violations: ConstraintViolation[]): ConstraintViolation[] {
  return violations.filter((v) => v.severity === "warning");
}

export function filterHardViolations(violations: ConstraintViolation[]): ConstraintViolation[] {
  return violations.filter((v) => v.severity === "error");
}
