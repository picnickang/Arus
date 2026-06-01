export type CrewAccessReadinessStatus =
  | "ready"
  | "no_login"
  | "login_disabled"
  | "no_password_set"
  | "temporary_password_issued"
  | "password_change_required"
  | "password_required"
  | "no_vessel_scope"
  | "no_dashboard"
  | "fleet_scope_review";

export interface CrewAccessReadiness {
  crewId: string;
  crewName: string;
  userId: string | null;
  status: CrewAccessReadinessStatus;
  reasons: string[];
  role: string | null;
  roleDisplayName: string | null;
  additionalRoles: string[];
  loginEnabled: boolean;
  mustChangePassword: boolean;
  hasPassword: boolean;
  vesselScope: "none" | "assigned" | "fleet";
  dashboardWidgetCount: number;
  dashboardTaskSourceCount: number;
  lastLoginAt: string | null;
}

export type FormerCrewAccessRiskFilter =
  | "all"
  | "linked_login"
  | "login_enabled"
  | "vessel_access"
  | "hub_access";

export interface FormerCrewAccessRisk {
  crewId: string;
  crewName: string;
  userId: string | null;
  hasLinkedLogin: boolean;
  accountActive: boolean;
  loginEnabled: boolean;
  vesselAccessCount: number;
  hasFleetAccess: boolean;
  hubAdmin: boolean;
  hubAccess: string[] | null;
  role: string | null;
  additionalRoles: string[];
  hasHighRiskRole: boolean;
  hasAccessRisk: boolean;
  reasons: string[];
}
