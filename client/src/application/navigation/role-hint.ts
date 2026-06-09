import { clearNavOverride, writeUserRole } from "@/infrastructure/navigation/nav-storage";

export function rememberRoleHint(roleHint: string) {
  writeUserRole(roleHint);
  clearNavOverride();
}
