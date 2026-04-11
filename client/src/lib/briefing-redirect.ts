const ROLE_LANDING: Record<string, string> = {
  chief_engineer: "/briefing",
  deck_officer: "/briefing",
  fleet_manager: "/dashboard",
  system_admin: "/system",
};

const STORAGE_KEY = "arus-user-role";
const REDIRECT_DISABLED_KEY = "arus-landing-redirect-disabled";

export function getBriefingRedirect(): string | null {
  if (typeof window !== "undefined" && localStorage.getItem(REDIRECT_DISABLED_KEY) === "true") {
    return null;
  }

  const role = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (!role || role === "default") return null;

  return ROLE_LANDING[role] || null;
}

export function isVesselRole(): boolean {
  const role = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return ["chief_engineer", "deck_officer"].includes(role || "");
}

export function disableLandingRedirect(): void {
  localStorage.setItem(REDIRECT_DISABLED_KEY, "true");
}

export function enableLandingRedirect(): void {
  localStorage.removeItem(REDIRECT_DISABLED_KEY);
}
