import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Ship,
  Users,
  AlertTriangle,
  Sparkles,
  Check,
  Menu,
  RefreshCw,
  User,
  FileText,
  Anchor,
  Plus,
  Pencil,
  X,
} from "lucide-react";
import { format, parseISO, addDays, differenceInDays as dateFnsDifferenceInDays } from "date-fns";
import {
  useSchedulePlannerData,
  type ScheduleAssignment,
  type ConstraintResult,
  type AiSuggestion,
  type CrewMember,
  type Vessel,
  type FatigueResult,
} from "@/features/crew/hooks/useSchedulePlannerData";
import { useHoRSync } from "@/features/crew/hooks/useHoRSync";
import { useOfflineSync } from "@/features/crew/hooks/useOfflineSync";
import { OfflineSyncIndicator } from "@/components/scheduling/OfflineSyncIndicator";
const ScheduleGeneratorPanel = lazy(() =>
  import("@/components/scheduling/ScheduleGeneratorPanel").then((m) => ({
    default: m.ScheduleGeneratorPanel,
  }))
);
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportTableToPDF } from "@/lib/exportUtils";
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { useIsMobile, getRoleColor, type DragState } from "./schedule-planner-utils";
import {
  MobileCrewRosterDrawer,
  DateRangeSelector,
  TimelineHeader,
  DragGhostPreview,
  AssignmentDrawerContent,
  VesselRow,
  type DragCompliancePreview,
} from "./schedule-planner-components";

function AssignmentDrawer({
  assignment,
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  violations,
  suggestions,
  fatigue,
  onApplySuggestion,
  onApplyChanges,
  isSaving,
}: {
  assignment: ScheduleAssignment | null;
  isOpen: boolean;
  onClose: () => void;
  activeTab: "details" | "constraints" | "suggestions" | "compliance";
  onTabChange: (tab: "details" | "constraints" | "suggestions" | "compliance") => void;
  violations: ConstraintResult[];
  suggestions: AiSuggestion[];
  fatigue?: FatigueResult;
  onApplySuggestion: (crewId: string) => void;
  onApplyChanges: () => void;
  isSaving: boolean;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!assignment) {
    return null;
  }

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh]" data-testid="assignment-drawer-mobile">
          <DrawerHeader className="border-b pb-3">
            <DrawerTitle className="flex items-center gap-2 text-left">
              <User className="h-5 w-5" />
              {assignment.crewName}
            </DrawerTitle>
          </DrawerHeader>
          <AssignmentDrawerContent
            assignment={assignment}
            activeTab={activeTab}
            onTabChange={onTabChange}
            violations={violations}
            suggestions={suggestions}
            fatigue={fatigue}
            onApplySuggestion={onApplySuggestion}
            onApplyChanges={onApplyChanges}
            onClose={onClose}
            isSaving={isSaving}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0" data-testid="assignment-drawer">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-left flex items-center gap-2">
            <User className="h-5 w-5" />
            ASSIGNMENT: {assignment.crewName.toUpperCase()}
          </SheetTitle>
        </SheetHeader>
        <AssignmentDrawerContent
          assignment={assignment}
          activeTab={activeTab}
          onTabChange={onTabChange}
          violations={violations}
          suggestions={suggestions}
          fatigue={fatigue}
          onApplySuggestion={onApplySuggestion}
          onApplyChanges={onApplyChanges}
          onClose={onClose}
          isSaving={isSaving}
        />
      </SheetContent>
    </Sheet>
  );
}

function VesselFilter({
  vessels,
  selectedId,
  onSelect,
}: {
  vessels: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        <Button
          variant={selectedId === null ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => onSelect(null)}
          data-testid="button-all-vessels"
        >
          <Anchor className="h-4 w-4" />
          <span>All Vessels</span>
        </Button>
        <Separator className="my-2" />
        {vessels.map((vessel) => (
          <Button
            key={vessel.id}
            variant={selectedId === vessel.id ? "secondary" : "ghost"}
            className="w-full justify-start gap-2"
            onClick={() => onSelect(vessel.id)}
            data-testid={`button-filter-vessel-${vessel.id}`}
          >
            <Ship className="h-4 w-4" />
            <span className="truncate">{vessel.name}</span>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}

interface CreateAssignmentData {
  vesselId?: string;
  vesselName?: string;
  startDate?: Date;
  crewId?: string;
}

function CreateAssignmentSheet({
  isOpen,
  onClose,
  prefillData,
  crew,
  vessels,
  onCreate,
  onRosterReassign,
  isCreating,
}: {
  isOpen: boolean;
  onClose: () => void;
  prefillData: CreateAssignmentData | null;
  crew: CrewMember[];
  vessels: Vessel[];
  onCreate: (data: {
    vesselId: string;
    crewId: string;
    role: string;
    startDate: string;
    endDate: string;
  }) => void;
  onRosterReassign?: (crewId: string, newVesselId: string) => Promise<void>;
  isCreating: boolean;
}) {
  const { toast } = useToast();
  const [selectedCrewId, setSelectedCrewId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showRosterWarning, setShowRosterWarning] = useState(false);
  const [pendingCrewSelection, setPendingCrewSelection] = useState<CrewMember | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);

  useEffect(() => {
    if (prefillData) {
      if (prefillData.startDate) {
        setEndDate(format(addDays(prefillData.startDate, 27), "yyyy-MM-dd"));
      }
      setSelectedCrewId(prefillData.crewId || "");
      setSelectedRole("");
    }
  }, [prefillData]);

  const availableCrew = crew.filter((c) => c.active && !c.onLeave);
  const selectedCrewMember = crew.find((c) => c.id === selectedCrewId);

  // Group crew by vessel assignment
  const vesselAssignedCrew = useMemo(
    () => availableCrew.filter((c) => c.vesselId === prefillData?.vesselId),
    [availableCrew, prefillData?.vesselId]
  );

  const otherAvailableCrew = useMemo(
    () => availableCrew.filter((c) => c.vesselId !== prefillData?.vesselId),
    [availableCrew, prefillData?.vesselId]
  );

  // Handle crew selection with roster check
  const handleCrewSelect = (crewId: string) => {
    const member = crew.find((c) => c.id === crewId);
    if (!member || !prefillData) {
      return;
    }

    // If crew is not assigned to this vessel, show warning
    if (member.vesselId !== prefillData.vesselId) {
      setPendingCrewSelection(member);
      setShowRosterWarning(true);
    } else {
      // Crew is already assigned to this vessel, select directly
      setSelectedCrewId(crewId);
    }
  };

  // Handle roster reassignment confirmation
  const handleConfirmRosterReassign = async () => {
    if (!pendingCrewSelection || !prefillData?.vesselId || !onRosterReassign) {
      return;
    }

    setIsReassigning(true);
    try {
      await onRosterReassign(pendingCrewSelection.id, prefillData.vesselId);
      setSelectedCrewId(pendingCrewSelection.id);
      setShowRosterWarning(false);
      setPendingCrewSelection(null);
    } catch (error) {
      console.error("Failed to reassign crew:", error);
      toast({
        title: "Roster Update Failed",
        description: "Could not reassign crew member to this vessel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReassigning(false);
    }
  };

  const handleCancelRosterReassign = () => {
    setShowRosterWarning(false);
    setPendingCrewSelection(null);
  };

  const handleCreate = () => {
    if (
      !prefillData?.vesselId ||
      !prefillData.startDate ||
      !selectedCrewId ||
      !selectedRole ||
      !endDate
    ) {
      return;
    }
    onCreate({
      vesselId: prefillData.vesselId,
      crewId: selectedCrewId,
      role: selectedRole,
      startDate: format(prefillData.startDate, "yyyy-MM-dd"),
      endDate,
    });
  };

  const isValid = !!prefillData && !!selectedCrewId && !!selectedRole && !!endDate;

  // Get vessel name for pending crew's current assignment
  const pendingCrewCurrentVessel = pendingCrewSelection?.vesselId
    ? vessels.find((v) => v.id === pendingCrewSelection.vesselId)?.name
    : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full sm:max-w-md p-0 flex flex-col"
        data-testid="create-assignment-sheet"
      >
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle className="text-left flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Assignment
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Vessel</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Ship className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{prefillData?.vesselName || "—"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {prefillData?.startDate
                    ? format(prefillData.startDate, "EEEE, MMM d, yyyy")
                    : "—"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="crew-select">Crew Member</Label>
              <Select value={selectedCrewId} onValueChange={handleCrewSelect}>
                <SelectTrigger id="crew-select" data-testid="select-crew">
                  <SelectValue placeholder="Select crew member" />
                </SelectTrigger>
                <SelectContent>
                  {vesselAssignedCrew.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Ship className="h-3 w-3" />
                        Assigned to {prefillData?.vesselName}
                      </div>
                      {vesselAssignedCrew.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <span>{member.name}</span>
                            <span className="text-muted-foreground text-xs">({member.rank})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {vesselAssignedCrew.length > 0 && otherAvailableCrew.length > 0 && (
                    <Separator className="my-1" />
                  )}
                  {otherAvailableCrew.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Other Available Crew
                      </div>
                      {otherAvailableCrew.map((member) => {
                        const memberVessel = member.vesselId
                          ? vessels.find((v) => v.id === member.vesselId)?.name
                          : null;
                        return (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <span>{member.name}</span>
                              <span className="text-muted-foreground text-xs">
                                ({member.rank})
                                {memberVessel ? ` - ${memberVessel}` : " - Unassigned"}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </>
                  )}
                  {vesselAssignedCrew.length === 0 && otherAvailableCrew.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No available crew members
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-select">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="role-select" data-testid="select-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Master",
                    "Chief Engineer",
                    "First Mate",
                    "Engineer",
                    "Deck Cadet",
                    "Cook",
                    "Steward",
                  ].map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", getRoleColor(role))} />
                        <span>{role}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={
                  prefillData?.startDate ? format(prefillData.startDate, "yyyy-MM-dd") : undefined
                }
                data-testid="input-end-date"
              />
            </div>

            {selectedCrewMember && (
              <div className="p-3 bg-muted/50 rounded-md space-y-1">
                <p className="text-sm font-medium">Selected: {selectedCrewMember.name}</p>
                <p className="text-xs text-muted-foreground">Rank: {selectedCrewMember.rank}</p>
                {selectedCrewMember.certifications &&
                  selectedCrewMember.certifications.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Certifications: {selectedCrewMember.certifications.slice(0, 3).join(", ")}
                    </p>
                  )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t flex gap-2 shrink-0">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            data-testid="button-cancel-create"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleCreate}
            disabled={!isValid || isCreating}
            data-testid="button-create-assignment"
          >
            {isCreating ? "Creating..." : "Create Assignment"}
          </Button>
        </div>
      </SheetContent>

      <AlertDialog open={showRosterWarning} onOpenChange={setShowRosterWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Roster Reassignment Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>{pendingCrewSelection?.name}</strong> is currently{" "}
                {pendingCrewCurrentVessel
                  ? `assigned to ${pendingCrewCurrentVessel}`
                  : "not assigned to any vessel"}
                .
              </p>
              <p>
                To schedule them on <strong>{prefillData?.vesselName}</strong>, their roster
                assignment will be updated to this vessel.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRosterReassign} disabled={isReassigning}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRosterReassign} disabled={isReassigning}>
              {isReassigning ? "Updating Roster..." : "Update Roster & Select"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

type AssignmentFilter = "all" | "published" | "drafts" | "generated";

export function SchedulePlanner() {
  const planner = useSchedulePlannerData();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileCrewRosterOpen, setMobileCrewRosterOpen] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [createPrefillData, setCreatePrefillData] = useState<CreateAssignmentData | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [stagedEdits, setStagedEdits] = useState<
    Map<string, { startDate: string; endDate: string }>
  >(new Map());
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragCompliancePreview, setDragCompliancePreview] = useState<DragCompliancePreview | null>(
    null
  );
  const [dragTarget, setDragTarget] = useState<{ vesselId: string; date: Date } | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);

  const horSync = useHoRSync();
  const offlineSync = useOfflineSync();
  const gridRef = useRef<HTMLDivElement>(null);
  const lastDragTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (isMobile && planner.dateRangePreset !== "2w") {
      planner.setDateRangePreset("2w");
    }
  }, [isMobile]);

  // Keyboard shortcut: Ctrl+G to toggle Generator panel
  useEffect(() => {
    if (!isFeatureEnabled("enableScheduleGenerator")) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGeneratorOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredAssignments = useMemo(() => {
    return planner.assignments.filter((a) => {
      const isGenerated = a.source === "generator" || !!a.generatedByRunId;
      switch (assignmentFilter) {
        case "published":
          return a.status === "published" || a.status === "confirmed";
        case "drafts":
          return a.status === "draft" && !isGenerated;
        case "generated":
          return a.status === "draft" && isGenerated;
        case "all":
        default:
          return true;
      }
    });
  }, [planner.assignments, assignmentFilter]);

  const getFilteredAssignmentsForVessel = useCallback(
    (vesselId: string): ScheduleAssignment[] => {
      return filteredAssignments.filter((a) => a.vesselId === vesselId);
    },
    [filteredAssignments]
  );

  const handlePointerDragStart = useCallback(
    (e: React.PointerEvent, assignment: ScheduleAssignment) => {
      setDragState({
        assignmentId: assignment.id,
        originalStartDate: assignment.startDate,
        originalEndDate: assignment.endDate,
        crewId: assignment.crewId,
        crewName: assignment.crewName,
        vesselId: assignment.vesselId,
      });
      setGhostPosition({ x: e.clientX, y: e.clientY });
      setDragCompliancePreview({
        canAssign: true,
        violations: [],
        projectedRestHours: 24,
        isLoading: true,
      });
    },
    []
  );

  const calculateDragTarget = useCallback(
    (clientX: number, clientY: number): { vesselId: string; date: Date } | null => {
      if (!gridRef.current || planner.timelineDays.length === 0) {
        return null;
      }

      const vesselRows = Array.from(
        gridRef.current.querySelectorAll('[data-testid^="vessel-row-"]')
      );
      let targetVesselId: string | null = null;

      for (const row of vesselRows) {
        const rowRect = row.getBoundingClientRect();
        if (clientY >= rowRect.top && clientY <= rowRect.bottom) {
          targetVesselId = row.getAttribute("data-testid")?.replace("vessel-row-", "") || null;
          break;
        }
      }

      if (!targetVesselId) {
        return null;
      }

      const cells = gridRef.current.querySelectorAll(`[data-testid^="cell-${targetVesselId}-"]`);
      let closestDate: Date | null = null;
      let closestDistance = Infinity;

      cells.forEach((cell, index) => {
        const cellRect = cell.getBoundingClientRect();
        const cellCenterX = cellRect.left + cellRect.width / 2;
        const distance = Math.abs(clientX - cellCenterX);

        if (distance < closestDistance && planner.timelineDays[index]) {
          closestDistance = distance;
          closestDate = planner.timelineDays[index];
        }
      });

      if (closestDate) {
        return { vesselId: targetVesselId, date: closestDate };
      }

      return null;
    },
    [planner.timelineDays]
  );

  const checkComplianceForTarget = useCallback(
    async (targetDate: Date, targetVesselId: string) => {
      if (!dragState) {
        return;
      }

      const originalStart = parseISO(dragState.originalStartDate);
      const originalEnd = parseISO(dragState.originalEndDate);
      const duration = dateFnsDifferenceInDays(originalEnd, originalStart);
      const newEndDate = addDays(targetDate, duration);

      const newStartStr = format(targetDate, "yyyy-MM-dd");
      const newEndStr = format(newEndDate, "yyyy-MM-dd");

      setDragCompliancePreview((prev) =>
        prev
          ? { ...prev, isLoading: true }
          : { canAssign: true, violations: [], projectedRestHours: 24, isLoading: true }
      );

      const draftAssignment = {
        id: dragState.assignmentId,
        crewId: dragState.crewId,
        crewName: dragState.crewName,
        vesselId: targetVesselId,
        start: newStartStr,
        end: newEndStr,
      };

      const complianceResult = await horSync.canAssignCrew(
        dragState.crewId,
        draftAssignment,
        planner.assignments
          .filter((a) => a.id !== dragState.assignmentId)
          .map((a) => ({
            id: a.id,
            crewId: a.crewId,
            crewName: a.crewName,
            vesselId: a.vesselId,
            start: a.startDate,
            end: a.endDate,
          }))
      );

      setDragCompliancePreview({
        canAssign: complianceResult.canAssign,
        violations: complianceResult.violations,
        projectedRestHours: complianceResult.projectedRestHours,
        isLoading: false,
      });
    },
    [dragState, horSync, planner.assignments]
  );

  const cancelDrag = useCallback(() => {
    setDragState(null);
    setDragCompliancePreview(null);
    setDragTarget(null);
    setGhostPosition(null);
    lastDragTargetRef.current = null;
    horSync.resetProjection();
  }, [horSync]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      setGhostPosition({ x: e.clientX, y: e.clientY });

      const target = calculateDragTarget(e.clientX, e.clientY);
      setDragTarget(target);

      if (target) {
        const key = `${format(target.date, "yyyy-MM-dd")}-${target.vesselId}`;
        if (lastDragTargetRef.current !== key) {
          lastDragTargetRef.current = key;
          checkComplianceForTarget(target.date, target.vesselId);
        }
      }
    };

    const handlePointerUp = () => {
      const currentTarget = dragTarget;
      if (currentTarget) {
        handleDrop(dragState.assignmentId, currentTarget.date, currentTarget.vesselId);
      } else {
        cancelDrag();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dragState, dragTarget, calculateDragTarget, checkComplianceForTarget, cancelDrag]);

  const handleDrop = useCallback(
    async (assignmentId: string, newStartDate: Date, targetVesselId: string) => {
      if (!dragState) {
        return;
      }

      const originalStart = parseISO(dragState.originalStartDate);
      const originalEnd = parseISO(dragState.originalEndDate);
      const duration = dateFnsDifferenceInDays(originalEnd, originalStart);
      const newEndDate = addDays(newStartDate, duration);

      const newStartStr = format(newStartDate, "yyyy-MM-dd");
      const newEndStr = format(newEndDate, "yyyy-MM-dd");

      let complianceResult =
        dragCompliancePreview && !dragCompliancePreview.isLoading
          ? {
              canAssign: dragCompliancePreview.canAssign,
              violations: dragCompliancePreview.violations,
              projectedRestHours: dragCompliancePreview.projectedRestHours,
            }
          : null;

      if (!complianceResult) {
        const draftAssignment = {
          id: assignmentId,
          crewId: dragState.crewId,
          crewName: dragState.crewName,
          vesselId: targetVesselId,
          start: newStartStr,
          end: newEndStr,
        };

        complianceResult = await horSync.canAssignCrew(
          dragState.crewId,
          draftAssignment,
          planner.assignments
            .filter((a) => a.id !== assignmentId)
            .map((a) => ({
              id: a.id,
              crewId: a.crewId,
              crewName: a.crewName,
              vesselId: a.vesselId,
              start: a.startDate,
              end: a.endDate,
            }))
        );
      }

      setDragState(null);
      setDragCompliancePreview(null);
      setGhostPosition(null);
      horSync.resetProjection();

      if (
        complianceResult &&
        !complianceResult.canAssign &&
        complianceResult.violations.some((v) => v.severity === "error")
      ) {
        toast({
          title: "Cannot Reschedule",
          description:
            complianceResult.violations.find((v) => v.severity === "error")?.description ||
            "STCW compliance violation",
          variant: "destructive",
        });
        return;
      }

      if (
        complianceResult &&
        complianceResult.violations.length > 0 &&
        complianceResult.canAssign
      ) {
        toast({
          title: "Warning",
          description: `Assignment moved with ${complianceResult.violations.length} warning(s)`,
        });
      }

      planner.updateAssignmentMutation.mutate({
        id: assignmentId,
        data: {
          startDate: newStartStr,
          endDate: newEndStr,
          vesselId: targetVesselId,
        },
      });
    },
    [
      dragState,
      dragCompliancePreview,
      horSync,
      planner.assignments,
      planner.updateAssignmentMutation,
      toast,
    ]
  );

  const handleMobileVesselSelect = (vesselId: string | null) => {
    planner.setSelectedVesselId(vesselId);
    setMobileFilterOpen(false);
  };

  const handleEmptyCellClick = (vesselId: string, vesselName: string, date: Date) => {
    setCreatePrefillData({ vesselId, vesselName, startDate: date });
    setIsCreateSheetOpen(true);
  };

  const handleCloseCreateSheet = () => {
    setIsCreateSheetOpen(false);
    setCreatePrefillData(null);
  };

  const handleCreateAssignment = (data: {
    vesselId: string;
    crewId: string;
    role: string;
    startDate: string;
    endDate: string;
  }) => {
    const crewMember = planner.crew.find((c) => c.id === data.crewId);
    const vessel = planner.vessels.find((v) => v.id === data.vesselId);

    planner.createAssignmentMutation.mutate(
      {
        vesselId: data.vesselId,
        vesselName: vessel?.name || "",
        crewId: data.crewId,
        crewName: crewMember?.name || "",
        role: data.role,
        startDate: data.startDate,
        endDate: data.endDate,
        status: "draft",
      },
      {
        onSuccess: () => {
          handleCloseCreateSheet();
        },
      }
    );
  };

  const handleApplySuggestion = (crewId: string) => {
    if (planner.selectedAssignmentId) {
      planner.applySuggestionMutation.mutate({
        assignmentId: planner.selectedAssignmentId,
        suggestedCrewId: crewId,
      });
    }
  };

  const handleApplyChanges = () => {
    if (planner.selectedAssignment) {
      planner.updateAssignmentMutation.mutate(
        {
          id: planner.selectedAssignment.id,
          data: {
            status: "confirmed",
          },
        },
        {
          onSuccess: () => {
            planner.closeDrawer();
          },
        }
      );
    } else {
      planner.closeDrawer();
    }
  };

  const handleRosterReassign = async (crewId: string, newVesselId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      planner.reassignCrewToVesselMutation.mutate(
        { crewId, vesselId: newVesselId },
        {
          onSuccess: () => resolve(),
          onError: (error) => reject(error),
        }
      );
    });
  };

  const handleExportCSV = () => {
    if (planner.assignments.length === 0) {
      toast({ title: "No Data", description: "No assignments to export.", variant: "destructive" });
      return;
    }
    const data = planner.assignments.map((a) => ({
      vessel: a.vesselName,
      crew_member: a.crewName,
      role: a.role,
      start_date: a.startDate,
      end_date: a.endDate,
      status: a.status,
    }));
    const metadataRow = {
      vessel: "",
      crew_member: "",
      role: "",
      start_date: "",
      end_date: `Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
      status: `Total: ${planner.assignments.length} assignments`,
    };
    const dataWithMeta = [
      ...data,
      { vessel: "", crew_member: "", role: "", start_date: "", end_date: "", status: "" },
      metadataRow,
    ];
    const dateRangeStr = `${format(planner.dateRangeStart, "yyyy-MM-dd")}_${format(planner.dateRangeEnd, "yyyy-MM-dd")}`;
    const success = exportToCSV(dataWithMeta, {
      filename: `crew-schedule_${dateRangeStr}.csv`,
      columns: ["vessel", "crew_member", "role", "start_date", "end_date", "status"],
      headers: {
        vessel: "Vessel",
        crew_member: "Crew Member",
        role: "Role",
        start_date: "Start Date",
        end_date: "End Date",
        status: "Status",
      },
    });
    if (success) {
      toast({ title: "Export Successful", description: "Schedule exported as CSV." });
    }
  };

  const handleExportPDF = async () => {
    if (planner.assignments.length === 0) {
      toast({ title: "No Data", description: "No assignments to export.", variant: "destructive" });
      return;
    }
    toast({ title: "Generating PDF", description: "Please wait..." });
    const headers = ["Vessel", "Crew Member", "Role", "Start Date", "End Date", "Status"];
    const rows = planner.assignments.map((a) => [
      a.vesselName,
      a.crewName,
      a.role,
      format(parseISO(a.startDate), "MMM d, yyyy"),
      format(parseISO(a.endDate), "MMM d, yyyy"),
      a.status.charAt(0).toUpperCase() + a.status.slice(1),
    ]);
    const dateRangeStr = `${format(planner.dateRangeStart, "MMM d")} - ${format(planner.dateRangeEnd, "MMM d, yyyy")}`;
    const generatedAt = format(new Date(), "yyyy-MM-dd HH:mm");
    try {
      const success = await exportTableToPDF(
        { headers, rows },
        {
          filename: `crew-schedule_${format(planner.dateRangeStart, "yyyy-MM-dd")}.pdf`,
          title: "Crew Schedule",
          subtitle: `Date Range: ${dateRangeStr} | Generated: ${generatedAt}`,
          orientation: "landscape",
        }
      );
      if (success) {
        toast({ title: "Export Successful", description: "Schedule exported as PDF." });
      } else {
        toast({
          title: "Export Failed",
          description: "Failed to generate PDF.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Export Failed",
        description: "An error occurred while generating PDF.",
        variant: "destructive",
      });
    }
  };

  const handleEnterEditMode = () => {
    setIsEditMode(true);
    setStagedEdits(new Map());
    toast({
      title: "Edit Mode",
      description: "Drag assignments to reschedule. Click Apply to save or Cancel to discard.",
    });
  };

  const handleCancelEditMode = () => {
    setIsEditMode(false);
    setStagedEdits(new Map());
    toast({ title: "Edit Cancelled", description: "All staged changes have been discarded." });
  };

  const handleApplyEditMode = async () => {
    if (stagedEdits.size === 0) {
      setIsEditMode(false);
      return;
    }
    toast({
      title: "Applying Changes",
      description: `Saving ${stagedEdits.size} modifications...`,
    });
    let successCount = 0;
    for (const [assignmentId, dates] of Array.from(stagedEdits.entries())) {
      try {
        await planner.updateAssignmentMutation.mutateAsync({ id: assignmentId, data: dates });
        successCount++;
      } catch {
        toast({
          title: "Update Failed",
          description: `Failed to update assignment.`,
          variant: "destructive",
        });
      }
    }
    if (successCount > 0) {
      toast({
        title: "Changes Applied",
        description: `${successCount} assignment${successCount !== 1 ? "s" : ""} updated successfully.`,
      });
    }
    setIsEditMode(false);
    setStagedEdits(new Map());
  };

  const handleStageEdit = (assignmentId: string, newStartDate: string, newEndDate: string) => {
    setStagedEdits((prev) => {
      const next = new Map(prev);
      next.set(assignmentId, { startDate: newStartDate, endDate: newEndDate });
      return next;
    });
  };

  const minWidth = isMobile
    ? `${planner.timelineDays.length * 32 + 112}px`
    : `${planner.timelineDays.length * 40 + 192}px`;

  return (
    <div className="flex flex-col h-full" data-testid="schedule-planner">
      <div className="flex flex-1 min-h-0">
        <div
          className={cn(
            "hidden md:flex flex-col border-r bg-muted/30 shrink-0 h-full transition-all duration-200",
            sidebarOpen ? "w-48" : "w-0 overflow-hidden"
          )}
        >
          <div className="p-3 border-b flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Ship className="h-4 w-4" />
              Filter
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarOpen(false)}
              data-testid="button-close-sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <VesselFilter
            vessels={planner.vessels}
            selectedId={planner.selectedVesselId}
            onSelect={planner.setSelectedVesselId}
          />
        </div>

        {!sidebarOpen && (
          <div className="hidden md:flex border-r bg-muted/30 flex-col items-center p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-open-sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-2 md:gap-4 p-2 md:p-3 border-b bg-background flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="md:hidden"
                    data-testid="button-mobile-filter"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SheetHeader className="p-3 border-b">
                    <SheetTitle className="flex items-center gap-2">
                      <Ship className="h-4 w-4" />
                      Filter Vessels
                    </SheetTitle>
                  </SheetHeader>
                  <VesselFilter
                    vessels={planner.vessels}
                    selectedId={planner.selectedVesselId}
                    onSelect={handleMobileVesselSelect}
                  />
                </SheetContent>
              </Sheet>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileCrewRosterOpen(true)}
                data-testid="button-mobile-crew-roster"
              >
                <Users className="h-4 w-4" />
              </Button>
              <DateRangeSelector
                preset={planner.dateRangePreset}
                onPresetChange={planner.setDateRangePreset}
                onNavigate={planner.navigateRange}
                onToday={planner.goToToday}
                startDate={planner.dateRangeStart}
                endDate={planner.dateRangeEnd}
              />
              <Select
                value={assignmentFilter}
                onValueChange={(v) => setAssignmentFilter(v as AssignmentFilter)}
              >
                <SelectTrigger className="w-[130px] h-9" data-testid="select-assignment-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="drafts">Drafts</SelectItem>
                  <SelectItem value="generated">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      Generated
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {isEditMode ? (
                <>
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-500 text-amber-600 dark:text-amber-400"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit Mode
                    {stagedEdits.size > 0 && (
                      <span className="ml-1 bg-amber-500 text-white rounded-full px-1.5 text-[10px]">
                        {stagedEdits.size}
                      </span>
                    )}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEditMode}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleApplyEditMode()}
                    disabled={stagedEdits.size === 0}
                    data-testid="button-apply-edit"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Apply ({stagedEdits.size})
                  </Button>
                </>
              ) : (
                <>
                  {planner.draftCount > 0 && (
                    <Badge variant="secondary" className="gap-1" data-testid="draft-count-badge">
                      <FileText className="h-3 w-3" />
                      {planner.draftCount} Draft{planner.draftCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  <OfflineSyncIndicator
                    state={offlineSync.state}
                    onSyncClick={offlineSync.syncNow}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex gap-1"
                    onClick={handleEnterEditMode}
                    data-testid="button-edit-mode"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:flex gap-1"
                        data-testid="button-export"
                      >
                        <Download className="h-4 w-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setTimeout(handleExportCSV, 0);
                        }}
                        data-testid="menu-export-csv"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setTimeout(() => {
                            void handleExportPDF();
                          }, 0);
                        }}
                        data-testid="menu-export-pdf"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                    onClick={() => offlineSync.syncNow()}
                    disabled={offlineSync.state.isSyncing}
                    data-testid="button-sync"
                  >
                    <RefreshCw
                      className={cn("h-4 w-4 mr-2", offlineSync.state.isSyncing && "animate-spin")}
                    />
                    {offlineSync.state.isSyncing ? "Syncing..." : "Sync"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="sm:hidden"
                    onClick={() => offlineSync.syncNow()}
                    disabled={offlineSync.state.isSyncing}
                    data-testid="button-sync-mobile"
                  >
                    <RefreshCw
                      className={cn("h-4 w-4", offlineSync.state.isSyncing && "animate-spin")}
                    />
                  </Button>
                  {isFeatureEnabled("enableScheduleGenerator") && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="hidden sm:flex gap-1"
                        onClick={() => setGeneratorOpen(true)}
                        data-testid="button-generate-schedule"
                      >
                        <Sparkles className="h-4 w-4" />
                        Generate
                      </Button>
                      <Button
                        variant="default"
                        size="icon"
                        className="sm:hidden"
                        onClick={() => setGeneratorOpen(true)}
                        data-testid="button-generate-schedule-mobile"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {planner.isLoadingVessels || planner.isLoadingAssignments ? (
              <div className="animate-pulse">
                <div className="flex border-b bg-muted/30">
                  <div className="w-48 p-2 border-r" />
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} className="w-20 p-2 border-r">
                      <div className="h-4 bg-muted rounded w-12" />
                    </div>
                  ))}
                </div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex border-b">
                    <div className="w-48 p-3 border-r">
                      <div className="h-5 bg-muted rounded w-24 mb-2" />
                      <div className="h-3 bg-muted rounded w-16" />
                    </div>
                    <div className="flex-1 flex items-center px-2">
                      <div className="h-8 bg-muted rounded" style={{ width: `${30 + i * 15}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : planner.filteredVessels.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Ship className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium">No Vessels Found</p>
                  <p className="text-sm text-muted-foreground">Add vessels to start scheduling.</p>
                </div>
              </div>
            ) : (
              <div ref={gridRef} style={{ minWidth }}>
                <TimelineHeader days={planner.timelineDays} isMobile={isMobile} />
                {planner.filteredVessels.map((vessel) => (
                  <VesselRow
                    key={vessel.id}
                    vessel={vessel}
                    assignments={getFilteredAssignmentsForVessel(vessel.id)}
                    timelineDays={planner.timelineDays}
                    calculateBlockPosition={planner.calculateBlockPosition}
                    getConstraintSummary={planner.getConstraintSummary}
                    getCrewFatigue={planner.getCrewFatigue}
                    onAssignmentClick={planner.openAssignmentDrawer}
                    onEmptyCellClick={handleEmptyCellClick}
                    isMobile={isMobile}
                    onPointerDragStart={handlePointerDragStart}
                    dragState={dragState}
                    dragCompliancePreview={dragCompliancePreview}
                    dragTargetVesselId={dragTarget?.vesselId}
                    dragTargetDate={dragTarget?.date}
                  />
                ))}
              </div>
            )}

            {dragState && ghostPosition && (
              <DragGhostPreview
                crewName={dragState.crewName}
                canAssign={dragCompliancePreview?.canAssign ?? true}
                isLoading={dragCompliancePreview?.isLoading ?? true}
                projectedRestHours={dragCompliancePreview?.projectedRestHours}
                position={ghostPosition}
              />
            )}
          </div>
        </div>

        {isFeatureEnabled("enableScheduleGenerator") && (
          <Suspense
            fallback={
              <div className="border-l flex flex-col bg-background w-80 md:w-96 animate-pulse">
                <div className="p-3 border-b flex items-center justify-between gap-2">
                  <div className="h-5 w-32 bg-muted rounded" />
                  <div className="h-7 w-7 bg-muted rounded" />
                </div>
                <div className="p-3 space-y-3">
                  <div className="h-8 w-full bg-muted rounded" />
                  <div className="h-24 w-full bg-muted rounded" />
                  <div className="h-24 w-full bg-muted rounded" />
                </div>
              </div>
            }
          >
            <ScheduleGeneratorPanel isOpen={generatorOpen} onOpenChange={setGeneratorOpen} />
          </Suspense>
        )}
      </div>

      <AssignmentDrawer
        assignment={planner.selectedAssignment}
        isOpen={planner.isDrawerOpen}
        onClose={planner.closeDrawer}
        activeTab={planner.drawerTab}
        onTabChange={planner.setDrawerTab}
        violations={planner.constraintViolations}
        suggestions={planner.aiSuggestions}
        fatigue={
          planner.selectedAssignment
            ? planner.getCrewFatigue(planner.selectedAssignment.crewId)
            : undefined
        }
        onApplySuggestion={handleApplySuggestion}
        onApplyChanges={handleApplyChanges}
        isSaving={
          planner.applySuggestionMutation.isPending || planner.updateAssignmentMutation.isPending
        }
      />

      <CreateAssignmentSheet
        isOpen={isCreateSheetOpen}
        onClose={handleCloseCreateSheet}
        prefillData={createPrefillData}
        crew={planner.crew}
        vessels={planner.vessels}
        onCreate={handleCreateAssignment}
        onRosterReassign={handleRosterReassign}
        isCreating={planner.createAssignmentMutation.isPending}
      />

      <MobileCrewRosterDrawer
        crew={planner.crew}
        vessels={planner.vessels}
        isOpen={mobileCrewRosterOpen}
        onClose={() => setMobileCrewRosterOpen(false)}
        onSelectCrew={(crewMember) => {
          setCreatePrefillData({ crewId: crewMember.id });
          setIsCreateSheetOpen(true);
        }}
      />
    </div>
  );
}
