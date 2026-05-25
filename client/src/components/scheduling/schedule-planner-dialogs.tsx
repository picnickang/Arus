import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Calendar, Ship, Users, AlertTriangle, User, Anchor, Plus } from "lucide-react";
import { format, addDays } from "date-fns";
import type {
  ScheduleAssignment,
  ConstraintResult,
  AiSuggestion,
  PlannerCrewMember as CrewMember,
  PlannerVessel as Vessel,
  FatigueResult,
} from "@/features/crew/hooks/useSchedulePlannerData";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getRoleColor } from "./schedule-planner-utils";
import { AssignmentDrawerContent } from "./schedule-planner-components";

export function AssignmentDrawer({
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
  fatigue?: FatigueResult | undefined;
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

export function VesselFilter({
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

export interface CreateAssignmentData {
  vesselId?: string;
  vesselName?: string;
  startDate?: Date;
  crewId?: string;
}

export function CreateAssignmentSheet({
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

  const vesselAssignedCrew = useMemo(
    () => availableCrew.filter((c) => c.vesselId === prefillData?.vesselId),
    [availableCrew, prefillData?.vesselId]
  );

  const otherAvailableCrew = useMemo(
    () => availableCrew.filter((c) => c.vesselId !== prefillData?.vesselId),
    [availableCrew, prefillData?.vesselId]
  );

  const handleCrewSelect = (crewId: string) => {
    const member = crew.find((c) => c.id === crewId);
    if (!member || !prefillData) {
      return;
    }

    if (member.vesselId !== prefillData.vesselId) {
      setPendingCrewSelection(member);
      setShowRosterWarning(true);
    } else {
      setSelectedCrewId(crewId);
    }
  };

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
