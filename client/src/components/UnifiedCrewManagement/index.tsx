import { useMemo, useState } from "react";
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
import { useRoleNames } from "@/hooks/useRoleNames";
import { UserAssignmentTab } from "@/components/crew-admin/UserAssignmentTab";
import { RolesDashboardsTab } from "@/components/crew-admin/RolesDashboardsTab";
import { SafetyTab } from "@/components/crew-admin/SafetyTab";

import { LifecycleDialog, useLifecycleDialog } from "./LifecycleDialog";
import { CrewFormDialog } from "./CrewFormDialog";
import { SkillFormDialog } from "./SkillFormDialog";
import { OnboardingChecklistDialog } from "./OnboardingChecklistDialog";
import { VesselReadinessPanel } from "./VesselReadinessPanel";
import { CrewRegistryLanding, type AttentionItem } from "./CrewRegistryLanding";
import { CurrentRoster } from "./CurrentRoster";
import { FormerArchive } from "./FormerArchive";
import type { CrewRowPermissions } from "./crew-roster-shared";

interface UnifiedCrewManagementProps {
  accessReadinessEnabled?: boolean;
}

type RegistryView = "registry" | "current" | "former" | "users" | "roles" | "safety";

// Must mirror the server-side crew-admin gate (`requireCrewAdminRole` →
// CREW_ADMIN_ROLES in server/domains/crew-admin/interfaces/routes.ts). Roles
// outside this set get 403 from every /api/admin/crew/* endpoint, so showing
// them the admin actions would only surface failing requests.
const ADMIN_ROLES = ["super_admin", "system_admin", "company_admin", "admin"];

const URGENCY_RANK: Record<AttentionItem["urgency"], number> = {
  critical: 0,
  warning: 1,
  notice: 2,
};

export function UnifiedCrewManagement({
  accessReadinessEnabled,
}: UnifiedCrewManagementProps = {}) {
  const { canCreate, canExport, canEdit, canDelete, hasPermission } = usePermissions();
  const { hasAnyRole } = useRoleNames();
  const isAdmin = hasAnyRole(...ADMIN_ROLES);
  const canUseSafety = hasPermission("safety_alarms", "view");
  const accessEnabled = accessReadinessEnabled ?? isAdmin;

  const d = useUnifiedCrewData({ accessReadinessEnabled: accessEnabled });
  const [view, setView] = useState<RegistryView>("registry");
  const [contactSectionOpen, setContactSectionOpen] = useState(false);
  const lifecycle = useLifecycleDialog();

  const { data: formerCrew = [], isLoading: formerLoading } = useFormerCrew();

  // Real compliance signals for the summary tiles + per-crew status pills.
  const { data: certExpiry, isLoading: certLoading } =
    useCertificationExpiryData({ daysAhead: 30 });
  const { data: docExpiry, isLoading: docLoading, getDocumentTypeLabel } =
    useDocumentExpiryData({ daysAhead: 30 });

  const expiryLoading = certLoading || docLoading;
  const expiryLoaded = !expiryLoading && (certExpiry !== undefined || docExpiry !== undefined);
  const expiringCrewIds = new Set<string>([
    ...(certExpiry?.certifications ?? []).map((c) => c.crewId),
    ...(docExpiry?.documents ?? []).map((doc) => doc.crewId),
  ]);

  // Merge expiring certificates and documents into one urgency-ranked list so
  // the landing shows a single "Needs attention" feed (no duplicate sections).
  const attentionItems: AttentionItem[] = useMemo(() => {
    const certItems: AttentionItem[] = (certExpiry?.certifications ?? []).map((c) => ({
      id: `cert-${c.id}`,
      kind: "cert",
      crewName: c.crewMemberName,
      label: c.cert,
      daysUntilExpiry: c.daysUntilExpiry,
      urgency: c.urgencyLevel,
      href: "/certificates",
    }));
    const docItems: AttentionItem[] = (docExpiry?.documents ?? []).map((doc) => ({
      id: `doc-${doc.id}`,
      kind: "doc",
      crewName: doc.crewMemberName,
      label: getDocumentTypeLabel(doc.documentType),
      daysUntilExpiry: doc.daysUntilExpiry,
      urgency: doc.urgencyLevel,
      href: "/compliance-consolidated",
    }));
    return [...certItems, ...docItems].sort((a, b) => {
      const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      return byUrgency !== 0 ? byUrgency : a.daysUntilExpiry - b.daysUntilExpiry;
    });
  }, [certExpiry, docExpiry, getDocumentTypeLabel]);

  const attentionCount = attentionItems.length;

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

  const activeCrew = d.crew.filter((c) => c.active);
  const activeCount = activeCrew.length;
  const onDutyCount = activeCrew.filter((c) => c.onDuty).length;
  const onLeaveCount = activeCount - onDutyCount;

  const openCurrent = (status: "all" | "on_duty" | "off_duty" = "all") => {
    d.setSelectedStatus(status);
    setView("current");
  };

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
              onDuty: onDutyCount,
              onLeave: onLeaveCount,
              attention: attentionCount,
              former: formerCrew.length,
            }}
            attentionItems={attentionItems}
            expiryLoading={expiryLoading}
            canCreate={userCanCreate}
            canManageDocs={perms.canManageCrew}
            isAdmin={isAdmin}
            canUseSafety={canUseSafety}
            onOpenCurrent={openCurrent}
            onOpenFormer={() => setView("former")}
            onAddCrew={() => d.setIsAddCrewDialogOpen(true)}
            onOpenUsers={() => setView("users")}
            onOpenRoles={() => setView("roles")}
            onOpenSafety={() => setView("safety")}
          />
        )}

        {view === "users" && isAdmin && <UserAssignmentTab />}
        {view === "roles" && isAdmin && <RolesDashboardsTab />}
        {view === "safety" && canUseSafety && <SafetyTab />}

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
