export interface VesselAssignment {
  id: string;
  vesselId: string | null;
  department: string | null;
  isActive: boolean;
}

export interface CrewUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
  loginEnabled: boolean;
  mustChangePassword: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  passwordUpdatedAt: string | null;
  supervisorUserId: string | null;
  assignments: VesselAssignment[];
  assignedRoleNames: string[];
  linkedCrewId: string | null;
  linkedCrewName: string | null;
  hubAdmin: boolean;
  hubAccess: string[] | null;
}

export interface CrewAdminRoleSummary {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  department?: string | null;
  hierarchyLevel?: number;
  isSystemRole?: boolean;
  isProtected?: boolean;
  isActive: boolean;
  assignedUserCount?: number;
}

export interface VesselLite {
  id: string;
  name: string;
}

export function sameHubAccess(a: string[] | null, b: string[] | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.length !== b.length) {
    return false;
  }
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

export function previewLine(
  u: CrewUser,
  roles: CrewAdminRoleSummary[],
  vessels: VesselLite[]
): string {
  const roleLabel = roles.find((r) => r.name === u.role)?.displayName ?? u.role;
  const extras = (u.assignedRoleNames ?? []).filter((n) => n !== u.role);
  const extraLabel =
    extras.length > 0 ? ` +${extras.length} role${extras.length > 1 ? "s" : ""}` : "";
  const vessel = u.assignments.find((a) => a.vesselId);
  const hasFleetScope = u.assignments.some((a) => a.vesselId === null);
  const scope = vessel
    ? (vessels.find((v) => v.id === vessel.vesselId)?.name ?? "Vessel")
    : hasFleetScope
      ? "Fleet-wide"
      : "No vessel access";
  return `This user will see: ${roleLabel}${extraLabel} Dashboard — ${scope}`;
}
