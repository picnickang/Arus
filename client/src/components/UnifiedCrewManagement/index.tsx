import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
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
  useCrewTasks,
  countTasks,
  isOverdue,
  isBlocked,
  formatRank,
} from "@/features/crew";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useRoleNames } from "@/hooks/useRoleNames";
import { AccessPermissionsView } from "@/components/crew-admin/AccessPermissionsView";
import { SafetyTab } from "@/components/crew-admin/SafetyTab";

import { LifecycleDialog, useLifecycleDialog } from "./LifecycleDialog";
import { CrewFormDialog } from "./CrewFormDialog";
import { SkillFormDialog } from "./SkillFormDialog";
import { OnboardingChecklistDialog } from "./OnboardingChecklistDialog";
import { VesselReadinessPanel } from "./VesselReadinessPanel";
import { CrewRegistryLanding, type CrewAttentionItem } from "./CrewRegistryLanding";
import { CurrentRoster } from "./CurrentRoster";
import { CrewOrgChart } from "./CrewOrgChart";
import { FormerArchive } from "./FormerArchive";
import { CrewTaskTracker } from "./CrewTaskTracker";
import type { CrewRowPermissions } from "./crew-roster-shared";

interface UnifiedCrewManagementProps {
  accessReadinessEnabled?: boolean;
}

type RegistryView = "registry" | "current" | "former" | "access" | "safety" | "tasks" | "orgchart";

const TASK_URGENCY_RANK: Record<CrewAttentionItem["urgency"], number> = {
  critical: 0,
  warning: 1,
  notice: 2,
};

// Must mirror the server-side crew-admin gate (`requireCrewAdminRole` →
// CREW_ADMIN_ROLES in server/domains/crew-admin/interfaces/routes.ts). Roles
// outside this set get 403 from every /api/admin/crew/* endpoint, so showing
// them the admin actions would only surface failing requests.
const ADMIN_ROLES = ["super_admin", "system_admin", "company_admin", "admin"];

const URGENCY_RANK: Record<CrewAttentionItem["urgency"], number> = {
  critical: 0,
  warning: 1,
  notice: 2,
};

export function UnifiedCrewManagement({ accessReadinessEnabled }: UnifiedCrewManagementProps = {}) {
  const { canCreate, canExport, canEdit, canDelete, hasPermission } = usePermissions();
  const { hasAnyRole } = useRoleNames();
  const isAdmin = hasAnyRole(...ADMIN_ROLES);
  const canUseSafety = hasPermission("safety_alarms", "view");
  const accessEnabled = accessReadinessEnabled ?? isAdmin;

  const d = useUnifiedCrewData({ accessReadinessEnabled: accessEnabled });
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const deepLinkTaskId = useMemo(
    () => new URLSearchParams(searchString).get("taskId"),
    [searchString]
  );
  const deepLinkView = useMemo(() => new URLSearchParams(searchString).get("view"), [searchString]);
  const [view, setView] = useState<RegistryView>("registry");
  const [contactSectionOpen, setContactSectionOpen] = useState(false);
  const [crewFormInitialStep, setCrewFormInitialStep] = useState(0);
  const lifecycle = useLifecycleDialog();

  // Keep the crew-form step intent self-cleaning: any time the form is closed,
  // reset to step 0 so the next open (Add Crew, row Edit, etc.) starts at the
  // beginning. Only the profile "Assign" action explicitly bumps it to the
  // assignment step right before opening.
  useEffect(() => {
    if (!d.isAddCrewDialogOpen && !d.isEditCrewDialogOpen) {
      setCrewFormInitialStep(0);
    }
  }, [d.isAddCrewDialogOpen, d.isEditCrewDialogOpen]);

  const { data: formerCrew = [], isLoading: formerLoading } = useFormerCrew();

  // Real compliance signals for the summary tiles + per-crew status pills.
  const { data: certExpiry, isLoading: certLoading } = useCertificationExpiryData({
    daysAhead: 30,
  });
  const {
    data: docExpiry,
    isLoading: docLoading,
    getDocumentTypeLabel,
  } = useDocumentExpiryData({ daysAhead: 30 });

  const expiryLoading = certLoading || docLoading;
  const expiryLoaded = !expiryLoading && (certExpiry !== undefined || docExpiry !== undefined);
  const expiringCrewIds = new Set<string>([
    ...(certExpiry?.certifications ?? []).map((c) => c.crewId),
    ...(docExpiry?.documents ?? []).map((doc) => doc.crewId),
  ]);

  // Crew missing a document their ROLE requires. Powers the roster needs-action
  // highlight. Empty for orgs whose roles declare no required documents.
  const { data: docCompliance = [] } = useQuery<
    { crewId: string; missing: string[]; expiring: string[] }[]
  >({ queryKey: ["/api/crew-roles/document-compliance"] });
  const needsActionCrewIds = new Set<string>(
    docCompliance.filter((r) => r.missing.length > 0).map((r) => r.crewId)
  );

  // Merge expiring certificates and documents into one urgency-ranked list so
  // the landing shows a single "Needs attention" feed (no duplicate sections).
  const attentionItems: CrewAttentionItem[] = useMemo(() => {
    const certItems: CrewAttentionItem[] = (certExpiry?.certifications ?? []).map((c) => ({
      id: `cert-${c.id}`,
      kind: "cert",
      crewName: c.crewMemberName,
      label: c.cert,
      daysUntilExpiry: c.daysUntilExpiry,
      urgency: c.urgencyLevel,
      href: "/certificates",
    }));
    const docItems: CrewAttentionItem[] = (docExpiry?.documents ?? []).map((doc) => ({
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

  const complianceAttentionCount = attentionItems.length;

  // Crew tasks power the landing "Open tasks" tile, the task attention rows,
  // and the Tasks view itself. includeDone so counts reflect the full board.
  const canViewTasks = hasPermission("crew_members", "view");
  const { data: crewTasks = [] } = useCrewTasks({ includeDone: true });
  const taskCounts = useMemo(() => countTasks(crewTasks), [crewTasks]);

  const taskCrewNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of d.crew) {
      map.set(c.id, c.name);
    }
    return map;
  }, [d.crew]);

  // Overdue or blocked tasks surface in the shared "Needs attention" feed.
  const taskAttention: CrewAttentionItem[] = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    return crewTasks
      .filter((t) => isOverdue(t) || isBlocked(t))
      .map((t) => {
        const overdue = isOverdue(t);
        const days = t.dueDate ? Math.round((new Date(t.dueDate).getTime() - now) / dayMs) : 0;
        return {
          id: `task-${t.id}`,
          kind: "task" as const,
          crewName: t.assignedCrewId
            ? (taskCrewNames.get(t.assignedCrewId) ?? "Unassigned")
            : "Unassigned",
          label: t.title,
          daysUntilExpiry: days,
          urgency: (overdue ? "critical" : "warning") as CrewAttentionItem["urgency"],
          href: `/crew-management?taskId=${t.id}`,
        };
      });
  }, [crewTasks, taskCrewNames]);

  const combinedAttention: CrewAttentionItem[] = useMemo(
    () =>
      [...attentionItems, ...taskAttention].sort((a, b) => {
        const byUrgency = TASK_URGENCY_RANK[a.urgency] - TASK_URGENCY_RANK[b.urgency];
        return byUrgency !== 0 ? byUrgency : a.daysUntilExpiry - b.daysUntilExpiry;
      }),
    [attentionItems, taskAttention]
  );

  const attentionCount = combinedAttention.length;

  // Deep-link into the Tasks view: `?taskId=…` (from the personal me/tasks
  // feed) pre-selects that task's detail; `?view=tasks` (from the Crew nav
  // "Crew Tasks" entry) opens the board directly. Must run before any early
  // return so hook order stays stable across renders.
  useEffect(() => {
    if ((deepLinkTaskId || deepLinkView === "tasks") && canViewTasks) {
      setView("tasks");
    } else if (!deepLinkTaskId && deepLinkView !== "tasks") {
      // The Tasks deep-link params were cleared (e.g. the user clicked the
      // "Crew Management" nav entry). Only fall back from the Tasks subview so
      // other subviews opened in-page (users/roles/current/…) are left intact.
      setView((v) => (v === "tasks" ? "registry" : v));
    }
  }, [deepLinkTaskId, deepLinkView, canViewTasks]);

  // Back-compat deep links: the old standalone subviews `?view=users` /
  // `?view=roles` now both resolve to the consolidated Access & Permissions
  // page (which opens on the matching inner tab). `?view=access` is the new
  // canonical link.
  useEffect(() => {
    if (
      (deepLinkView === "access" || deepLinkView === "users" || deepLinkView === "roles") &&
      isAdmin
    ) {
      setView("access");
    }
  }, [deepLinkView, isAdmin]);

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
        {view !== "registry" && view !== "tasks" && (
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
              complianceAttention: complianceAttentionCount,
              former: formerCrew.length,
              taskActive: taskCounts.active,
              taskOverdue: taskCounts.overdue,
            }}
            attentionItems={combinedAttention}
            expiryLoading={expiryLoading}
            canCreate={userCanCreate}
            canManageDocs={perms.canManageCrew}
            isAdmin={isAdmin}
            canUseSafety={canUseSafety}
            canViewTasks={canViewTasks}
            onOpenCurrent={openCurrent}
            onOpenFormer={() => setView("former")}
            onOpenOrgChart={() => setView("orgchart")}
            onOpenTasks={() => setLocation("/crew-management?view=tasks")}
            onAddCrew={() => d.setIsAddCrewDialogOpen(true)}
            onOpenAccess={() => setView("access")}
            onOpenSafety={() => setView("safety")}
          />
        )}

        {view === "tasks" && canViewTasks && (
          <CrewTaskTracker
            crew={d.crew.map((c) => ({ id: c.id, name: c.name, rank: c.rank }))}
            vessels={d.vessels.map((v) => ({ id: v.id, name: v.name }))}
            canCreate={userCanCreate}
            canEdit={perms.canManageCrew}
            canDelete={perms.canDeleteCrew}
            initialTaskId={deepLinkTaskId}
            onOpenCrewProfile={(crewId) => {
              const member = d.crew.find((c) => c.id === crewId);
              if (member) {
                d.handleViewProfile(member);
              }
            }}
            onBack={() => setLocation("/crew-management")}
          />
        )}

        {view === "orgchart" && <CrewOrgChart d={d} />}

        {view === "access" && isAdmin && (
          <AccessPermissionsView initialTab={deepLinkView === "roles" ? "roles" : "accounts"} />
        )}
        {view === "safety" && canUseSafety && <SafetyTab />}

        {view === "current" && (
          <>
            {d.accessReadinessEnabled && d.accessReadinessError && (
              <Alert variant="destructive" data-testid="alert-access-readiness-unavailable">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Access readiness unavailable</AlertTitle>
                <AlertDescription>
                  Crew roster data is loaded, but login and dashboard readiness could not be
                  checked.
                </AlertDescription>
              </Alert>
            )}
            {d.accessReadinessEnabled && <VesselReadinessPanel d={d} />}
            <CurrentRoster
              d={d}
              formerCount={formerCrew.length}
              expiringCrewIds={expiringCrewIds}
              needsActionCrewIds={needsActionCrewIds}
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
        initialStep={crewFormInitialStep}
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
            reportsToName={
              d.viewingCrew.reportsToId
                ? (d.crew.find((c) => c.id === d.viewingCrew?.reportsToId)?.name ?? null)
                : null
            }
            canManage={perms.canManageCrew}
            onEdit={() => {
              const member = d.viewingCrew;
              if (!member) {
                return;
              }
              setCrewFormInitialStep(0);
              d.closeProfileDialog();
              d.handleEditCrew(member);
            }}
            onAssign={() => {
              const member = d.viewingCrew;
              if (!member) {
                return;
              }
              setCrewFormInitialStep(1);
              d.closeProfileDialog();
              d.handleEditCrew(member);
            }}
            onArchive={() => {
              const member = d.viewingCrew;
              if (!member) {
                return;
              }
              d.closeProfileDialog();
              lifecycle.open(
                "retire",
                member.id,
                member.name,
                member.vesselId ? d.getVesselName(member.vesselId) : undefined,
                member.contractPenalty
              );
            }}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
}
