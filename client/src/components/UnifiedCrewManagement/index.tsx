import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { CertificationExpiryAlertBanner } from "@/components/CertificationExpiryAlerts";
import { DocumentExpiryAlertBanner } from "@/components/DocumentExpiryAlerts";
import { CrewViewDialogContent } from "@/components/unified-crew-components";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import {
  useUnifiedCrewData,
  useFormerCrew,
  useCertificationExpiryData,
  useDocumentExpiryData,
  formatRank,
} from "@/features/crew";
import { usePermissions } from "@/contexts/PermissionsContext";

import { LifecycleDialog, useLifecycleDialog } from "./LifecycleDialog";
import { CrewFormDialog } from "./CrewFormDialog";
import { SkillFormDialog } from "./SkillFormDialog";
import { OnboardingChecklistDialog } from "./OnboardingChecklistDialog";
import { VesselReadinessPanel } from "./VesselReadinessPanel";
import { CrewRegistryLanding } from "./CrewRegistryLanding";
import { CurrentRoster } from "./CurrentRoster";
import { FormerArchive } from "./FormerArchive";
import type { CrewRowPermissions } from "./crew-roster-shared";

interface UnifiedCrewManagementProps {
  accessReadinessEnabled?: boolean;
}

type RegistryView = "registry" | "current" | "former";

export function UnifiedCrewManagement({
  accessReadinessEnabled = false,
}: UnifiedCrewManagementProps = {}) {
  const d = useUnifiedCrewData({ accessReadinessEnabled });
  const { canCreate, canExport, canEdit, canDelete, hasPermission } = usePermissions();
  const [view, setView] = useState<RegistryView>("registry");
  const [contactSectionOpen, setContactSectionOpen] = useState(false);
  const lifecycle = useLifecycleDialog();

  const { data: formerCrew = [], isLoading: formerLoading } = useFormerCrew();

  // Real compliance signals for the summary tiles + per-crew status pills.
  const { data: certExpiry, isLoading: certLoading, unacknowledgedCerts } =
    useCertificationExpiryData({ daysAhead: 30 });
  const { data: docExpiry, isLoading: docLoading, unacknowledgedDocs } =
    useDocumentExpiryData({ daysAhead: 30 });

  const expiryLoading = certLoading || docLoading;
  const expiryLoaded = !expiryLoading && (certExpiry !== undefined || docExpiry !== undefined);
  const expiringCount = (certExpiry?.summary.total ?? 0) + (docExpiry?.summary.total ?? 0);
  const alertsCount = unacknowledgedCerts.length + unacknowledgedDocs.length;
  const expiringCrewIds = new Set<string>([
    ...(certExpiry?.certifications ?? []).map((c) => c.crewId),
    ...(docExpiry?.documents ?? []).map((doc) => doc.crewId),
  ]);

  const perms: CrewRowPermissions = {
    canManageCrew: canEdit("crew_members"),
    canDeleteCrew: canDelete("crew_members"),
    canManageAccess:
      hasPermission("permission_management", "edit") || hasPermission("crew_members", "edit"),
  };
  const userCanCreate = canCreate("crew_members");
  const userCanExport = canExport("crew_members");

  if (d.crewLoading) {
    return <div className="p-6 text-slate-300">Loading crew data...</div>;
  }

  const activeCount = d.crew.filter((c) => c.active).length;

  return (
    <div className="ops-surface -mx-4 -my-4 min-h-[70vh] rounded-none p-4 md:-mx-6 md:-my-6 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {view !== "registry" && (
          <button
            type="button"
            onClick={() => setView("registry")}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-white"
            data-testid="button-back-registry"
          >
            <ArrowLeft className="h-4 w-4" /> Crew registry
          </button>
        )}

        <CertificationExpiryAlertBanner />
        <DocumentExpiryAlertBanner />

        {view === "registry" && (
          <CrewRegistryLanding
            counts={{
              current: activeCount,
              former: formerCrew.length,
              expiring: expiringCount,
              alerts: alertsCount,
            }}
            expiryLoading={expiryLoading}
            canCreate={userCanCreate}
            canManageDocs={perms.canManageCrew}
            onOpenCurrent={() => setView("current")}
            onOpenFormer={() => setView("former")}
            onAddCrew={() => d.setIsAddCrewDialogOpen(true)}
            onReviewAlerts={() => setView("current")}
          />
        )}

        {view === "current" && (
          <>
            {d.accessReadinessEnabled && d.accessReadinessError && (
              <Alert variant="destructive" data-testid="alert-access-readiness-unavailable">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Access readiness unavailable</AlertTitle>
                <AlertDescription>
                  Crew roster data is loaded, but login and dashboard readiness could not be checked.
                </AlertDescription>
              </Alert>
            )}
            {d.accessReadinessEnabled && <VesselReadinessPanel d={d} />}
            <CurrentRoster
              d={d}
              formerCount={formerCrew.length}
              expiringCrewIds={expiringCrewIds}
              expiryLoaded={expiryLoaded}
              openLifecycle={lifecycle.open}
              onSwitchToFormer={() => setView("former")}
              perms={perms}
              canExport={userCanExport}
              canCreate={userCanCreate}
              onAddCrew={() => d.setIsAddCrewDialogOpen(true)}
            />
          </>
        )}

        {view === "former" && (
          <FormerArchive
            d={d}
            formerCrew={formerCrew}
            formerLoading={formerLoading}
            currentCount={activeCount}
            openLifecycle={lifecycle.open}
            onSwitchToCurrent={() => setView("current")}
            perms={perms}
            canExport={userCanExport}
          />
        )}
      </div>

      <LifecycleDialog state={lifecycle.state} onClose={lifecycle.close} />

      <CrewFormDialog
        d={d}
        contactSectionOpen={contactSectionOpen}
        setContactSectionOpen={setContactSectionOpen}
      />

      <SkillFormDialog d={d} />
      <OnboardingChecklistDialog d={d} />

      <ResponsiveDialog
        open={d.isViewProfileDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            d.closeProfileDialog();
          }
        }}
        title={d.viewingCrew ? `${d.viewingCrew.name}` : "Crew Profile"}
        description={
          d.viewingCrew
            ? `${formatRank(d.viewingCrew.rank)} - View and manage crew member details`
            : ""
        }
        className="max-w-2xl"
      >
        {d.viewingCrew && (
          <CrewViewDialogContent
            crew={d.viewingCrew}
            vessels={d.vessels}
            initialTab={d.profileInitialTab}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
}
