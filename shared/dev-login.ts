export const DEV_USER_ROLES = [
  "deck_officer",
  "crew_member",
  "technician",
  "logistics_user",
  "procurement_user",
  "safety_officer",
  "maintenance_planner",
  "viewer",
] as const;

export type DevUserRole = (typeof DEV_USER_ROLES)[number];

export type DevLoginRequest = { persona: "admin" } | { persona: "user"; role: DevUserRole };

export interface DevLoginResponse {
  sessionToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
  user: {
    id: string;
    email?: string;
    name: string | null;
    role: string;
    orgId?: string;
  };
}

const DEV_USER_ROLE_SET: ReadonlySet<string> = new Set(DEV_USER_ROLES);

export function isDevUserRole(value: string | null | undefined): value is DevUserRole {
  return typeof value === "string" && DEV_USER_ROLE_SET.has(value);
}

export function devUserRoleLabel(role: DevUserRole): string {
  return role
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
