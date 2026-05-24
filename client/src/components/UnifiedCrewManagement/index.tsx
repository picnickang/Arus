import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Plus, UserCheck, UserX } from "lucide-react";
import { CertificationExpiryAlertBanner } from "@/components/CertificationExpiryAlerts";
import { DocumentExpiryAlertBanner } from "@/components/DocumentExpiryAlerts";
import {
  ActiveCrewStats,
  FormerCrewStats,
  CrewViewDialogContent,
} from "@/components/unified-crew-components";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { useUnifiedCrewData, useFormerCrew, formatRank } from "@/features/crew";

import { LifecycleDialog, useLifecycleDialog } from "./LifecycleDialog";
import { RosterFilters } from "./RosterFilters";
import { RosterTable } from "./RosterTable";
import { CrewFormDialog } from "./CrewFormDialog";
import { SkillFormDialog } from "./SkillFormDialog";

export function UnifiedCrewManagement() {
  const d = useUnifiedCrewData();
  const [rosterView, setRosterView] = useState<"active" | "former">("active");
  const [contactSectionOpen, setContactSectionOpen] = useState(false);
  const lifecycle = useLifecycleDialog();

  const { data: formerCrew = [], isLoading: formerLoading } = useFormerCrew();

  if (d.crewLoading) {
    return <div className="p-6">Loading crew data...</div>;
  }

  const activeCrewOnly = d.filteredAndSortedCrew.filter((c) => c.active);
  const displayCrew = rosterView === "active" ? activeCrewOnly : formerCrew;
  const isFormerView = rosterView === "former";

  return (
    <div className="space-y-6">
      <CertificationExpiryAlertBanner />
      <DocumentExpiryAlertBanner />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs
          value={rosterView}
          onValueChange={(v) => setRosterView(v as "active" | "former")}
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
          <Button onClick={d.handleExportCSV} variant="outline" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {!isFormerView && (
            <Button onClick={() => d.setIsAddCrewDialogOpen(true)} data-testid="button-add-crew">
              <Plus className="h-4 w-4 mr-2" />
              Add Crew Member
            </Button>
          )}
        </div>
      </div>

      {!isFormerView && <ActiveCrewStats stats={d.stats} />}
      {isFormerView && <FormerCrewStats count={formerCrew.length} />}

      {!isFormerView && <RosterFilters d={d} />}

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
        {d.viewingCrew && <CrewViewDialogContent crew={d.viewingCrew} vessels={d.vessels} />}
      </ResponsiveDialog>
    </div>
  );
}
