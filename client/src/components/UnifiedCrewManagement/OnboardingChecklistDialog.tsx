import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { CheckCircle2, Circle, Clock, FileText, KeyRound, XCircle } from "lucide-react";
import { useUnifiedCrewData, type CrewAccessReadinessStatus } from "@/features/crew";

type UnifiedCrewData = ReturnType<typeof useUnifiedCrewData>;

const BLOCKING_ACCESS: CrewAccessReadinessStatus[] = [
  "no_login",
  "login_disabled",
  "no_password_set",
  "password_required",
  "no_vessel_scope",
  "no_dashboard",
  "fleet_scope_review",
];

function ChecklistItem({
  state,
  label,
  detail,
}: {
  state: "done" | "missing" | "pending" | "not_required";
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border p-3">
      {state === "done" ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
      ) : state === "pending" || state === "not_required" ? (
        <Clock className="h-4 w-4 text-amber-600 mt-0.5" />
      ) : state === "missing" ? (
        <XCircle className="h-4 w-4 text-destructive mt-0.5" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
      )}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function OnboardingChecklistDialog({ d }: { d: UnifiedCrewData }) {
  const crew = d.onboardingCrew;
  const access = crew ? d.accessReadinessByCrewId.get(crew.id) : undefined;
  const loginSkipped = crew ? d.skippedLoginCrewIds.has(crew.id) : false;
  const loginCreated = !!crew?.userId && access?.status !== "no_login";
  const accessReady = access?.status === "ready";
  const accessSetupComplete =
    loginSkipped ||
    accessReady ||
    access?.status === "temporary_password_issued" ||
    access?.status === "password_change_required";
  const accessBlocking = access ? BLOCKING_ACCESS.includes(access.status) : !crew?.userId;
  const emergencyContactReady = !!crew?.emergencyContactName && !!crew?.emergencyContactPhone;
  const profileReady =
    !!crew &&
    !!crew.vesselId &&
    !!crew.rank &&
    emergencyContactReady;
  const accessStatusText = loginSkipped
    ? "Login intentionally skipped for now."
    : access?.reasons[0] ?? "No login linked yet.";

  return (
    <ResponsiveDialog
      open={!!crew}
      onOpenChange={(open) => {
        if (!open) {
          d.closeOnboardingDialog();
        }
      }}
      title={crew ? `Onboarding readiness: ${crew.name}` : "Onboarding readiness"}
      description="Finish the operational steps and keep deployment readiness honest."
      footer={
        <div className="flex flex-wrap gap-2 w-full">
          <Button type="button" variant="outline" onClick={d.closeOnboardingDialog}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => d.openOnboardingProfileTab("documents")}
            data-testid="button-onboarding-docs"
          >
            <FileText className="h-4 w-4 mr-1" />
            Docs & Certs
          </Button>
          {d.accessReadinessEnabled && (
            <>
              {!loginCreated && !loginSkipped && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={d.skipOnboardingLogin}
                  data-testid="button-onboarding-skip-login"
                >
                  Skip Login for Now
                </Button>
              )}
            <Button
              type="button"
              onClick={() => d.openOnboardingProfileTab("access")}
              data-testid="button-onboarding-access"
            >
              <KeyRound className="h-4 w-4 mr-1" />
              Set Up Access
            </Button>
            </>
          )}
        </div>
      }
    >
      {crew && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={profileReady ? "default" : "outline"}>
              {profileReady ? "Profile Ready" : "Profile Incomplete"}
            </Badge>
            <Badge variant={accessSetupComplete ? "secondary" : "destructive"}>
              {accessSetupComplete ? "Access Setup Tracked" : "Access Missing"}
            </Badge>
            <Badge variant="outline">Documents Not Assessed</Badge>
            <Badge variant="destructive">Deployment Ready: No</Badge>
            <p className="text-sm text-muted-foreground">
              Deployment remains pending until documents/certificates are reviewed.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChecklistItem state="done" label="Crew profile created" detail="The roster record exists." />
            <ChecklistItem
              state={crew.vesselId ? "done" : "missing"}
              label="Vessel assigned"
              detail={crew.vesselId ? d.getVesselName(crew.vesselId) : "Missing vessel assignment."}
            />
            <ChecklistItem state={crew.rank ? "done" : "missing"} label="Role/rank selected" detail={crew.rank} />
            <ChecklistItem
              state={emergencyContactReady ? "done" : "pending"}
              label="Emergency contact added"
              detail={
                emergencyContactReady
                  ? "Emergency contact is recorded."
                  : "Not required yet, but recommended before deployment."
              }
            />
            <ChecklistItem
              state={loginCreated ? "done" : loginSkipped ? "not_required" : "missing"}
              label={loginSkipped ? "Login intentionally skipped" : "Login created"}
              detail={loginSkipped ? "Access setup is deferred and not deployment-ready." : accessStatusText}
            />
            <ChecklistItem
              state={
                loginSkipped
                  ? "not_required"
                  : accessReady
                    ? "done"
                    : access?.status === "temporary_password_issued" ||
                        access?.status === "password_change_required"
                      ? "pending"
                      : accessBlocking
                        ? "missing"
                        : "pending"
              }
              label="Access scope, role, and password"
              detail={accessStatusText}
            />
            <ChecklistItem
              state="pending"
              label="Documents/certificates"
              detail="Not assessed in this roster flow; review documents before deployment."
            />
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
