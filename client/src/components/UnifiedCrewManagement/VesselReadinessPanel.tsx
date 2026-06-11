import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShipWheel } from "lucide-react";
import {
  useUnifiedCrewData,
  type CrewAccessReadinessStatus,
  type CrewListItem,
} from "@/features/crew";

type UnifiedCrewData = ReturnType<typeof useUnifiedCrewData>;

type ReadinessIssue = {
  crew: CrewListItem;
  reason: string;
  severity: "blocker" | "warning";
};

const ACCESS_BLOCKER_STATUSES: ReadonlySet<CrewAccessReadinessStatus> = new Set([
  "no_login",
  "login_disabled",
  "no_password_set",
  "password_required",
  "no_vessel_scope",
  "no_dashboard",
  "fleet_scope_review",
]);

function accessIssueForStatus(status: CrewAccessReadinessStatus): string | null {
  switch (status) {
    case "no_login":
      return "Missing login";
    case "login_disabled":
      return "Login disabled";
    case "no_password_set":
      return "No password set";
    case "password_required":
      return "Password required";
    case "no_vessel_scope":
      return "No vessel scope";
    case "no_dashboard":
      return "No dashboard/role";
    case "fleet_scope_review":
      return "Fleet-wide access needs review";
    case "temporary_password_issued":
      return "Temporary password issued; user must change it on first login";
    case "password_change_required":
      return "User must change password before continuing";
    default:
      return null;
  }
}

export function VesselReadinessPanel({ d }: { d: UnifiedCrewData }) {
  if (d.selectedVessel === "all") {
    return null;
  }

  const vesselName = d.getVesselName(d.selectedVessel);
  const assignedCrew = d.crew.filter((crew) => crew.active && crew.vesselId === d.selectedVessel);
  const activeWithoutAssignment = d.crew.filter((crew) => crew.active && !crew.vesselId);
  const formerWithActiveLogin = d.formerAccessRisks.filter((risk) => risk.loginEnabled);

  const issues = assignedCrew.flatMap((crew): ReadinessIssue[] => {
    const access = d.accessReadinessByCrewId.get(crew.id);
    const status: CrewAccessReadinessStatus | null =
      access?.status ?? (!crew.userId ? "no_login" : null);

    if (!status || status === "ready") {
      return [];
    }

    const reason = accessIssueForStatus(status);
    if (!reason) {
      return [];
    }

    return [
      {
        crew,
        reason,
        severity: ACCESS_BLOCKER_STATUSES.has(status) ? "blocker" : "warning",
      },
    ];
  });

  const accessBlockers = issues.filter((issue) => issue.severity === "blocker");
  const userPendingWarnings = issues.filter((issue) => issue.severity === "warning");
  const crewAssignmentReady = assignedCrew.length > 0;
  const accessReady = crewAssignmentReady && accessBlockers.length === 0;
  const deploymentStatus = crewAssignmentReady ? "Pending document review" : "No assigned crew";

  return (
    <Card data-testid="panel-vessel-readiness">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ShipWheel className="h-4 w-4" />
          Vessel Readiness: {vesselName || d.selectedVessel}
          <Badge variant={crewAssignmentReady ? "default" : "destructive"}>
            Crew {crewAssignmentReady ? "Assigned" : "Missing"}
          </Badge>
          <Badge variant={accessReady ? "default" : "destructive"}>
            Access {accessReady ? "Ready" : "Needs Action"}
          </Badge>
          <Badge variant="outline">Documents Not Assessed</Badge>
          <Badge variant="secondary">Deployment: {deploymentStatus}</Badge>
        </CardTitle>
        <CardDescription>
          Separates crew assignment, access setup, and deployment readiness so document placeholders
          do not permanently mark every vessel as simply “Not ready.”
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Assigned</p>
            <p className="font-semibold">{assignedCrew.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">On duty</p>
            <p className="font-semibold">{assignedCrew.filter((crew) => crew.onDuty).length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Access blockers</p>
            <p className="font-semibold">{accessBlockers.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">User-pending</p>
            <p className="font-semibold">{userPendingWarnings.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Docs</p>
            <p className="font-semibold">Not assessed</p>
          </div>
          <div>
            <p className="text-muted-foreground">Unassigned active</p>
            <p className="font-semibold">{activeWithoutAssignment.length}</p>
          </div>
        </div>

        {accessBlockers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Access blockers</p>
            {accessBlockers.map(({ crew, reason }) => (
              <div
                key={`${crew.id}-${reason}`}
                className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 p-2"
              >
                <div>
                  <p className="text-sm font-medium">{crew.name}</p>
                  <p className="text-xs text-muted-foreground">{reason}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => d.handleViewProfile(crew, "access")}
                >
                  Fix
                </Button>
              </div>
            ))}
          </div>
        )}

        {userPendingWarnings.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">User-pending access warnings</p>
            {userPendingWarnings.map(({ crew, reason }) => (
              <div
                key={`${crew.id}-${reason}`}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-300/60 bg-amber-50/50 p-2"
              >
                <div>
                  <p className="text-sm font-medium">{crew.name}</p>
                  <p className="text-xs text-muted-foreground">{reason}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => d.handleViewProfile(crew, "access")}
                >
                  Review
                </Button>
              </div>
            ))}
          </div>
        )}

        {assignedCrew.length > 0 &&
          accessBlockers.length === 0 &&
          userPendingWarnings.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Crew assignment and access setup are ready for this vessel. Deployment remains pending
              until documents/certificates are assessed.
            </p>
          )}
        {assignedCrew.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No active crew are assigned to this vessel yet.
          </p>
        )}
        <div className="rounded-md border border-amber-300/60 bg-amber-50/50 p-3 text-sm">
          <p className="font-medium">Document readiness not assessed</p>
          <p className="text-muted-foreground">
            This panel does not claim deployment readiness until required documents and certificates
            are reviewed.
          </p>
        </div>
        {formerWithActiveLogin.length > 0 && (
          <div className="rounded-md border border-destructive/30 p-3 text-sm">
            <p className="font-medium text-destructive">Former crew with active login</p>
            <p className="text-muted-foreground">
              {formerWithActiveLogin.map((item) => item.crewName).join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
