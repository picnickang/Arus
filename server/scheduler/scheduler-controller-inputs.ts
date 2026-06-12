import {
  dbCrewExtensionsStorage,
  dbCrewStorage,
  dbVesselStorage,
} from "../repositories";
import type { SelectCrewAssignment } from "@shared/schema";

export async function loadShiftTemplates(orgId: string, vessels?: string[]) {
  const allShifts = await dbCrewStorage.getShiftTemplates();
  const orgShifts = allShifts.filter((s) => !s.orgId || s.orgId === orgId);
  if (!vessels || vessels.length === 0) {
    return orgShifts;
  }
  return orgShifts.filter((s) => !s.vesselId || vessels.includes(s.vesselId));
}

export async function loadCrewWithSkills(orgId: string) {
  // Single-query bulk fetch + group-by-crewId avoids the prior
  // N+1 (one getCrewSkills call per crew member).
  const [crew, allSkills] = await Promise.all([
    dbCrewStorage.getCrew(orgId),
    dbCrewStorage.getAllCrewSkills(orgId),
  ]);
  const byCrewId = new Map<string, string[]>();
  for (const s of allSkills) {
    const arr = byCrewId.get(s.crewId);
    if (arr) {
      arr.push(s.skill);
    } else {
      byCrewId.set(s.crewId, [s.skill]);
    }
  }
  return crew.map((c) => ({ ...c, skills: byCrewId.get(c.id) ?? [] }));
}

export async function loadCrewLeaves(orgId: string) {
  // Single org-scoped query replaces the per-crew Promise.all fan-out
  // (the storage layer already supports filtering by orgId alone).
  return dbCrewStorage.getCrewLeave(undefined, orgId);
}

export async function loadPortCalls(orgId: string, vessels?: string[]) {
  const allPortCalls = await dbVesselStorage.getAllPortCalls(orgId);
  if (!vessels || vessels.length === 0) {
    return allPortCalls;
  }
  return allPortCalls.filter((pc) => vessels.includes(pc.vesselId));
}

export async function loadDrydocks(orgId: string, vessels?: string[]) {
  const allDrydocks = await dbVesselStorage.getAllDrydockWindows(orgId);
  if (!vessels || vessels.length === 0) {
    return allDrydocks;
  }
  return allDrydocks.filter((d) => vessels.includes(d.vesselId));
}

export async function loadCertifications(orgId: string) {
  const certsList = await (
    dbCrewExtensionsStorage.getCrewCertifications as (
      crewId: string | undefined,
      orgId: string
    ) => Promise<Array<{ crewId: string; [k: string]: unknown }>>
  )("", orgId);
  const certsMap: { [crewId: string]: Array<{ crewId: string; [k: string]: unknown }> } = {};
  for (const cert of certsList) {
    (certsMap[cert.crewId] ||= []).push(cert);
  }
  return certsMap;
}

export async function loadExistingAssignments(
  orgId: string,
  from: string,
  to: string
): Promise<SelectCrewAssignment[]> {
  return dbCrewStorage.getCrewAssignmentsByDateRange(new Date(from), new Date(to));
}

export function aggregateReasons(reasons: string[]): Array<{ reason: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of reasons) {
    map.set(r, (map.get(r) ?? 0) + 1);
  }
  return Array.from(map, ([reason, count]) => ({ reason, count }));
}
