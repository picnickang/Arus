/**
 * Crew Scheduler OR-Tools - Helper Functions
 * Time window and validation utilities
 */

import type { CrewWithSkills, SelectCrewLeave, SelectPortCall, SelectDrydockWindow, SelectCrewCertification } from "./types.js";

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return Math.max(aStart.getTime(), bStart.getTime()) < Math.min(aEnd.getTime(), bEnd.getTime());
}

export function toUtc(day: string, timeHHmm: string): Date {
  return new Date(`${day}T${timeHHmm}Z`);
}

export function shiftWindow(day: string, startTime: string, endTime: string): { start: Date; end: Date } {
  const start = toUtc(day, startTime);
  let end = toUtc(day, endTime);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 3600 * 1000);
  }
  return { start, end };
}

export function leaveOverlaps(crewId: string, shiftStart: Date, shiftEnd: Date, leaves: SelectCrewLeave[]): boolean {
  return leaves.some((leave) => {
    if (leave.crewId !== crewId) { return false; }
    const leaveStart = new Date(leave.start);
    const leaveEnd = new Date(leave.end);
    return overlaps(shiftStart, shiftEnd, leaveStart, leaveEnd);
  });
}

export function isWindowAllowed(
  day: string,
  startTime: string,
  endTime: string,
  vesselId: string,
  portCalls: SelectPortCall[],
  drydocks: SelectDrydockWindow[]
): boolean {
  const { start: shiftStart, end: shiftEnd } = shiftWindow(day, startTime, endTime);

  for (const drydock of drydocks) {
    if (drydock.vesselId === vesselId) {
      const drydockStart = new Date(drydock.start);
      const drydockEnd = new Date(drydock.end);
      if (overlaps(shiftStart, shiftEnd, drydockStart, drydockEnd)) {
        return false;
      }
    }
  }

  for (const portCall of portCalls) {
    if (portCall.vesselId === vesselId) {
      const portStart = new Date(portCall.start);
      const portEnd = new Date(portCall.end);
      if (overlaps(shiftStart, shiftEnd, portStart, portEnd)) {
        return true;
      }
    }
  }

  return true;
}

export function isNightShift(startTime: string): boolean {
  const hour = Number.parseInt(startTime.split(":")[0], 10);
  return hour >= 20 || hour < 6;
}

export function hasValidCertification(
  crew: CrewWithSkills,
  requiredCert: string,
  shiftStart: Date,
  shiftEnd: Date,
  certifications: { [crewId: string]: SelectCrewCertification[] }
): boolean {
  if (!requiredCert) { return true; }
  const crewCerts = certifications[crew.id] ?? [];

  for (const cert of crewCerts) {
    if (cert.cert === requiredCert) {
      const expiryDate = new Date(cert.expiresAt);
      if (expiryDate >= shiftEnd) {
        return true;
      }
    }
  }

  return false;
}
