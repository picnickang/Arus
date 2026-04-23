import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";




import {
  type ScheduleAssignment,
  type ConstraintResult,
  type AiSuggestion,
  type FatigueResult,
} from "@/features/crew/hooks/useSchedulePlannerData";
import { cn } from "@/lib/utils";


import {
  DetailsTab,
  ConstraintsTab,
  SuggestionsTab,
} from "../schedule-planner-tabs";


import { ComplianceTab } from "./ComplianceTab";

export function AssignmentDrawerContent({
  assignment,
  activeTab,
  onTabChange,
  violations,
  suggestions,
  fatigue,
  onApplySuggestion,
  onApplyChanges,
  onClose,
  isSaving,
  isSuggestionsLoading = false,
}: {
  assignment: ScheduleAssignment;
  activeTab: "details" | "constraints" | "suggestions" | "compliance";
  onTabChange: (tab: "details" | "constraints" | "suggestions" | "compliance") => void;
  violations: ConstraintResult[];
  suggestions: AiSuggestion[];
  fatigue?: FatigueResult;
  onApplySuggestion: (crewId: string) => void;
  onApplyChanges: () => void;
  onClose: () => void;
  isSaving: boolean;
  isSuggestionsLoading?: boolean;
}) {
  const hardCount = violations.filter((v) => v.severity === "HARD").length;
  const softCount = violations.filter((v) => v.severity === "SOFT").length;

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange(v as typeof activeTab)}
        className="flex-1"
      >
        <TabsList className="w-full justify-start rounded-none border-b h-auto p-0">
          <TabsTrigger
            value="details"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            data-testid="tab-details"
          >
            Details
          </TabsTrigger>
          <TabsTrigger
            value="constraints"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary gap-1"
            data-testid="tab-constraints"
          >
            Constraints
            {(hardCount > 0 || softCount > 0) && (
              <span
                className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                  hardCount > 0 ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                )}
              >
                {hardCount + softCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="suggestions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            data-testid="tab-suggestions"
          >
            AI
          </TabsTrigger>
          <TabsTrigger
            value="compliance"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            data-testid="tab-compliance"
          >
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex-1 mt-0">
          <DetailsTab assignment={assignment} />
        </TabsContent>

        <TabsContent value="constraints" className="flex-1 mt-0">
          <ConstraintsTab violations={violations} />
        </TabsContent>

        <TabsContent value="suggestions" className="flex-1 mt-0">
          <SuggestionsTab
            suggestions={suggestions}
            onApply={onApplySuggestion}
            isPending={isSuggestionsLoading}
          />
        </TabsContent>

        <TabsContent value="compliance" className="flex-1 mt-0">
          <ComplianceTab assignment={assignment} fatigue={fatigue} />
        </TabsContent>
      </Tabs>

      <div className="p-4 border-t flex gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1"
          data-testid="button-cancel-drawer"
        >
          Cancel
        </Button>
        <Button
          onClick={onApplyChanges}
          className="flex-1"
          disabled={isSaving}
          data-testid="button-apply-changes"
        >
          {isSaving ? "Saving..." : "Apply Changes"}
        </Button>
      </div>
    </>
  );
}

