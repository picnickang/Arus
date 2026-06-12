import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";

export interface CrewCert {
  id: string;
  crewId: string;
  cert: string;
  expiresAt: string;
  issuedBy?: string;
}

export interface SchedulerCrew {
  id: string;
  name: string;
  rank: string;
  vesselId?: string;
  maxHours7d: number;
  minRestH: number;
  active: boolean;
  skills: string[];
}

export const CREW_CERTIFICATION_TYPES = [
  { value: "STCW", label: "STCW Basic Safety Training" },
  { value: "STCW_ADV", label: "STCW Advanced Fire Fighting" },
  { value: "STCW_MED", label: "STCW Medical First Aid" },
  { value: "STCW_SURV", label: "STCW Proficiency in Survival Craft" },
  { value: "STCW_CROWD", label: "STCW Crowd Management" },
  { value: "BOSIET", label: "BOSIET (Offshore Safety)" },
  { value: "HUET", label: "HUET (Helicopter Underwater Escape)" },
  { value: "DP_BASIC", label: "DP Basic Operator" },
  { value: "DP_ADV", label: "DP Advanced Operator" },
  { value: "GMDSS_GOC", label: "GMDSS GOC (Radio Operator)" },
  { value: "GMDSS_ROC", label: "GMDSS ROC (Restricted)" },
  { value: "OOW_DECK", label: "OOW Deck (Officer of the Watch)" },
  { value: "OOW_ENGINE", label: "OOW Engine (Engineer)" },
  { value: "CHIEF_MATE", label: "Chief Mate CoC" },
  { value: "MASTER", label: "Master CoC" },
  { value: "CHIEF_ENGINEER", label: "Chief Engineer CoC" },
  { value: "2ND_ENGINEER", label: "Second Engineer CoC" },
  { value: "SSO", label: "SSO (Ship Security Officer)" },
  { value: "DPA", label: "DPA (Designated Person Ashore)" },
  { value: "EFA", label: "Elementary First Aid" },
  { value: "MEDICAL_CARE", label: "Medical Care (Ship's Doctor)" },
  { value: "HAZMAT", label: "Hazardous Materials Handling" },
  { value: "IGS", label: "IGS (Inert Gas Systems)" },
  { value: "CRANE_OP", label: "Crane Operator Certificate" },
  { value: "OTHER", label: "Other Certification" },
] as const;

export function getCertLabel(value: string): string {
  return CREW_CERTIFICATION_TYPES.find((ct) => ct.value === value)?.label || value;
}

export function QualificationBridge({
  certRequired,
  crew,
  certifications,
}: {
  certRequired: string;
  crew: SchedulerCrew[];
  certifications: CrewCert[];
}) {
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const matchingCerts = certifications.filter(
    (c) => c.cert === certRequired || c.cert.toUpperCase().includes(certRequired.toUpperCase())
  );
  const qualifiedCrewIds = new Set(
    matchingCerts.filter((c) => !c.expiresAt || new Date(c.expiresAt) > now).map((c) => c.crewId)
  );
  const expiringCrewIds = new Set(
    matchingCerts
      .filter(
        (c) => c.expiresAt && new Date(c.expiresAt) > now && new Date(c.expiresAt) <= in90Days
      )
      .map((c) => c.crewId)
  );
  const expiredCrewIds = new Set(
    matchingCerts.filter((c) => c.expiresAt && new Date(c.expiresAt) <= now).map((c) => c.crewId)
  );
  const activeCount = crew.filter((c) => c.active).length;
  const missingCount = activeCount - qualifiedCrewIds.size - expiredCrewIds.size;

  if (qualifiedCrewIds.size === 0 && expiredCrewIds.size === 0) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-xs" data-testid="qualification-bridge">
        <ShieldAlert className="h-3 w-3 text-amber-500" />
        <span className="text-amber-500">
          No crew hold this certification —{" "}
          {missingCount > 0 ? `${missingCount} crew without` : "check crew certifications"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-1.5 text-xs" data-testid="qualification-bridge">
      <span className="flex items-center gap-1">
        <ShieldCheck className="h-3 w-3 text-green-500" />
        <span className="text-green-600">{qualifiedCrewIds.size} qualified</span>
      </span>
      {expiringCrewIds.size > 0 && (
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          <span className="text-amber-500">{expiringCrewIds.size} expiring</span>
        </span>
      )}
      {expiredCrewIds.size > 0 && (
        <span className="flex items-center gap-1">
          <ShieldAlert className="h-3 w-3 text-red-500" />
          <span className="text-red-500">{expiredCrewIds.size} expired</span>
        </span>
      )}
      {missingCount > 0 && <span className="text-muted-foreground">{missingCount} without</span>}
    </div>
  );
}
