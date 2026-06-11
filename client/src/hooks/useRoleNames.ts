import { useMemo } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";

/**
 * Single shared role-normalization helper. Derives the normalized list of role
 * names from `/api/permissions/me` and exposes membership helpers so the User
 * page and the Crew Management admin pages stop doing ad-hoc role parsing.
 */
export interface RoleNamesResult {
  roleNames: string[];
  hasRole: (role: string) => boolean;
  hasAnyRole: (...roles: string[]) => boolean;
  isLoading: boolean;
}

export function useRoleNames(): RoleNamesResult {
  const { roles, isLoading } = useUserPermissions();

  return useMemo(() => {
    // `/api/permissions/me` returns role objects ({ id, name, displayName }).
    // Older callers and dev fixtures may still hand back plain strings, so
    // normalize both shapes to the lowercase role `name`.
    const roleNames = Array.isArray(roles)
      ? roles
          .map((r) => {
            if (typeof r === "string") {
              return r;
            }
            if (r && typeof r === "object" && "name" in r) {
              return String((r as { name: unknown }).name);
            }
            return "";
          })
          .map((name) => name.trim().toLowerCase())
          .filter(Boolean)
      : [];
    const roleSet = new Set(roleNames);
    return {
      roleNames,
      hasRole: (role: string) => roleSet.has(role.trim().toLowerCase()),
      hasAnyRole: (...roleArgs: string[]) =>
        roleArgs.some((role) => roleSet.has(role.trim().toLowerCase())),
      isLoading,
    };
  }, [roles, isLoading]);
}
