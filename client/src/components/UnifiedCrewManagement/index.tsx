import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Download, Plus, UserCheck, UserX } from "lucide-react";
import { CertificationExpiryAlertBanner } from "@/components/CertificationExpiryAlerts";
import { DocumentExpiryAlertBanner } from "@/components/DocumentExpiryAlerts";
import {
  ActiveCrewStats,
  FormerCrewStats,
  CrewViewDialogContent,
} from "@/components/unified-crew-components";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { useUnifiedCrewData, useFormerCrew, formatRank, type CrewListItem } from "@/features/crew";
import { usePermissions } from "@/contexts/PermissionsContext";

import { LifecycleDialog, useLifecycleDialog } from "./LifecycleDialog";
import { RosterFilters } from "./RosterFilters";
import { RosterTable } from "./RosterTable";
import { CrewFormDialog } from "./CrewFormDialog";
import { SkillFormDialog } from "./SkillFormDialog";
import { OnboardingChecklistDialog } from "./OnboardingChecklistDialog";
import { VesselReadinessPanel } from "./VesselReadinessPanel";

interface UnifiedCrewManagementProps {
  accessReadinessEnabled?: boolean;
}

export function UnifiedCrewManagement({
  accessReadinessEnabled = false,
}: UnifiedCrewManagementProps = {}) {
  const d = useUnifiedCrewData({ accessReadinessEnabled });
  const { canCreate, canExport } = usePermissions();
  const [rosterView, setRosterView] = useState<"active" | "former">("active");
  const [contactSectionOpen, setContactSectionOpen] = useState(false);
  const lifecycle = useLifecycleDialog();

  const { data: formerCrew = [], isLoading: formerLoading } = useFormerCrew();

  if (d.crewLoading) {
    return <div className="p-6">Loading crew data...</div>;
  }

  const isFormerView = rosterView === "former";
  const baseCrew =
    rosterView === "active"
      ? d.crew.filter((c) => c.active)
      : (formerCrew as unknown as CrewListItem[]);
  const displayCrew = d.getFilteredSortedCrew(baseCrew, {
    includeStatusFilter: !isFormerView,
    includeAccessFilter: !isFormerView && d.accessReadinessEnabled,
    includeFormerAccessRiskFilter: isFormerView && d.accessReadinessEnabled,
  });
  const exportLabel = rosterView === "active" ? "active-crew-roster" : "former-crew-roster";

  return (
    <div className="space-y-6">
      <CertificationExpiryAlertBanner />
      <DocumentExpiryAlertBanner />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs
          value={rosterView}
          onValueChange={(v) => {
            setRosterView(v as "active" | "former");
            d.setSelectedStatus("all");
            d.setSelectedAccessStatus("all");
            d.setSelectedFormerAccessRisk("all");
          }}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active-roster">
              <UserCheck className="h-4 w-4 mr-2" />
              Active Roster ({d.crew.filter((c) => c.active).length})
            </TabsTrigger>
            <TabsTrigger value="former" data-testid="tab-former-roster">
              <UserX className="h-4 w-4 mr-2" />
              Former Crew ({formerCrew.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {canExport("crew_members") && (
            <Button
              onClick={() => d.handleExportCSV(displayCrew, exportLabel)}
              variant="outline"
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
          {!isFormerView && canCreate("crew_members") && (
            <Button onClick={() => d.setIsAddCrewDialogOpen(true)} data-testid="button-add-crew">
              <Plus className="h-4 w-4 mr-2" />
              Add Crew Member
            </Button>
          )}
        </div>
      </div>

      {!isFormerView && <ActiveCrewStats stats={d.stats} />}
      {isFormerView && <FormerCrewStats count={formerCrew.length} />}

      <RosterFilters
        d={d}
        rosterView={rosterView}
        visibleCount={displayCrew.length}
        totalCount={baseCrew.length}
      />

      {!isFormerView && d.accessReadinessEnabled && d.accessReadinessError && (
        <Alert variant="destructive" data-testid="alert-access-readiness-unavailable">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access readiness unavailable</AlertTitle>
          <AlertDescription>
            Crew roster data is loaded, but login and dashboard readiness could not be checked.
          </AlertDescription>
        </Alert>
      )}
      {!isFormerView && d.accessReadinessEnabled && <VesselReadinessPanel d={d} />}

      <RosterTable
        d={d}
        isFormerView={isFormerView}
        formerLoading={formerLoading}
        displayCrew={displayCrew}
        openLifecycle={lifecycle.open}
      />

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
