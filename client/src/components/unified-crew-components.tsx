import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Ship,
  Power,
  Edit,
  Trash2,
  UserCheck,
  Award,
  UserX,
  User,
  Bell,
  History,
  FileText,
  KeyRound,
  ListChecks,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Archive,
  ArrowRightLeft,
  CalendarClock,
} from "lucide-react";
import { CrewDocumentsTab } from "@/components/CrewDocumentsTab";
import { CrewNotificationSettingsTab } from "@/components/CrewNotificationSettingsTab";
import { CrewAccessTab } from "@/components/crew-admin/CrewAccessTab";
import { CrewAvatar } from "@/components/UnifiedCrewManagement/crew-roster-shared";
import { CrewPhotoModal } from "@/components/UnifiedCrewManagement/CrewPhotoModal";
import type { CrewProfileTab } from "@/features/crew";
import { useRoleNames } from "@/hooks/useRoleNames";
import {
  useEmploymentHistory,
  useUpdateEmploymentHistory,
  useDeleteEmploymentHistory,
  useCrewTasks,
  useCrewDocumentsData,
  crewStatusLabel,
  employmentTypeLabel,
  formatRotation,
  statusLabel,
  priorityLabel,
  dueLabel,
  isOverdue,
  formatRank,
  type EmploymentHistoryRecord,
  type UpdateEmploymentHistoryInput,
} from "@/features/crew";
import { format } from "date-fns";

interface EmploymentHistoryPanelProps {
  crewId: string;
}

export function EmploymentHistoryPanel({ crewId }: EmploymentHistoryPanelProps) {
  const { data: history = [], isLoading } = useEmploymentHistory(crewId);
  const updateMutation = useUpdateEmploymentHistory();
  const deleteMutation = useDeleteEmploymentHistory();
  const [editingRecord, setEditingRecord] = useState<EmploymentHistoryRecord | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleEditClick = (record: EmploymentHistoryRecord) => {
    setEditingRecord(record);
    setEditStartDate(record.startDate ? record.startDate.split("T")[0] ?? "" : "");
    setEditEndDate(record.endDate ? record.endDate.split("T")[0] ?? "" : "");
    setEditNotes(record.terminationNotes || "");
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }
    const data: UpdateEmploymentHistoryInput = {};
    if (editStartDate) {
      data.startDate = new Date(editStartDate).toISOString();
    }
    if (editEndDate) {
      data.endDate = new Date(editEndDate).toISOString();
    }
    data.terminationNotes = editNotes;
    updateMutation.mutate(
      { historyId: editingRecord.id, data },
      { onSuccess: () => setEditingRecord(null) }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, { onSuccess: () => setDeleteConfirmId(null) });
  };

  if (isLoading) {
    return <div className="py-4 text-center text-muted-foreground">Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="py-4 text-center text-muted-foreground">No employment history records</div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((record: EmploymentHistoryRecord) => (
        <Card key={record.id} className="bg-muted/50">
          <CardContent className="pt-4 pb-3">
            {editingRecord?.id === record.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      data-testid="input-edit-start-date"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <Input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      data-testid="input-edit-end-date"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes about this period"
                    data-testid="input-edit-notes"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRecord(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={record.terminationType === "retired" ? "secondary" : "destructive"}
                    >
                      {record.terminationType === "retired" ? "Retired" : "Contract Cancelled"}
                    </Badge>
                    {record.rank && <Badge variant="outline">{formatRank(record.rank)}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(record.startDate), "MMM d, yyyy")} -{" "}
                    {record.endDate ? format(new Date(record.endDate), "MMM d, yyyy") : "Present"}
                  </p>
                  {record.terminationNotes && (
                    <p className="text-sm mt-1">{record.terminationNotes}</p>
                  )}
                  {record.contractPenalty && (
                    <p className="text-sm text-destructive">
                      Penalty: ${record.contractPenalty.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditClick(record)}
                    data-testid={`button-edit-period-${record.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {deleteConfirmId === record.id ? (
                    <div className="flex gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-confirm-delete-${record.id}`}
                      >
                        {deleteMutation.isPending ? "..." : "Yes"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteConfirmId(null)}
                        data-testid={`button-cancel-delete-${record.id}`}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmId(record.id)}
                      data-testid={`button-delete-period-${record.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface CrewStats {
  totalCrew: number;
  activeCrew: number;
  onDutyCrew: number;
  uniqueVessels: number;
  uniqueSkills: number;
}

interface ActiveCrewStatsProps {
  stats: CrewStats;
}

export function ActiveCrewStats({ stats }: ActiveCrewStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-total-crew">
              {stats.totalCrew}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Total Crew</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-600" />
            <div className="text-2xl font-bold text-green-600" data-testid="stat-active-crew">
              {stats.activeCrew}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Active</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-orange-600" />
            <div className="text-2xl font-bold text-orange-600" data-testid="stat-on-duty-crew">
              {stats.onDutyCrew}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">On Duty</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-purple-600" />
            <div className="text-2xl font-bold text-purple-600" data-testid="stat-vessels">
              {stats.uniqueVessels}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Vessels</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-teal-600" />
            <div className="text-2xl font-bold text-teal-600" data-testid="stat-skills">
              {stats.uniqueSkills}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Unique Skills</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface FormerCrewStatsProps {
  count: number;
}

export function FormerCrewStats({ count }: FormerCrewStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-muted-foreground" />
            <div className="text-2xl font-bold" data-testid="stat-former-crew">
              {count}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Former Crew</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface Vessel {
  id: string;
  name: string;
  active: boolean;
}

interface ViewingCrewMember {
  id: string;
  name: string;
  rank: string;
  vesselId?: string | null;
  active: boolean;
  onDuty: boolean;
  maxHours7d: number;
  minRestH: number;
  hourlyRate?: number | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  startDate?: string | null;
  contractEndDate?: string | null;
  contractPenalty?: number | null;
  skills?: string[];
  photoPath?: string | null;
  crewCode?: string | null;
  status?: string | null;
  employmentType?: string | null;
  reportsToId?: string | null;
  rotationOnDays?: number | null;
  rotationOffDays?: number | null;
}

interface CrewViewDialogContentProps {
  crew: ViewingCrewMember;
  vessels: Vessel[];
  initialTab?: CrewProfileTab;
  reportsToName?: string | null;
  canManage?: boolean;
  onEdit?: () => void;
  onAssign?: () => void;
  onArchive?: () => void;
}

/**
 * Compliance snapshot derived purely from the crew member's live documents
 * (passport / medical / training endorsement) plus whether a profile photo is
 * on file. No fabricated state — each badge reflects a real record's expiry.
 */
function ComplianceSnapshot({
  crewId,
  hasPhoto,
}: {
  crewId: string;
  hasPhoto: boolean;
}) {
  const { documents, isLoading, getExpiryStatus } = useCrewDocumentsData(crewId);

  const evaluate = (types: string[]) => {
    const matches = documents.filter((doc) => types.includes(doc.documentType));
    if (matches.length === 0) {
      return { tone: "missing" as const, label: "Missing" };
    }
    // Worst-case across all matching docs decides the badge tone.
    let worst: "ok" | "due" = "ok";
    for (const doc of matches) {
      const status = getExpiryStatus(doc.expiresAt);
      if (status && status.level !== "ok") {
        worst = "due";
      }
    }
    return worst === "ok"
      ? { tone: "ok" as const, label: "Valid" }
      : { tone: "due" as const, label: "Due" };
  };

  const items = [
    { key: "passport", title: "Passport", ...evaluate(["passport"]) },
    { key: "medical", title: "Medical", ...evaluate(["medical"]) },
    { key: "stcw", title: "STCW / Training", ...evaluate(["endorsement", "seaman_book"]) },
    {
      key: "photo",
      title: "Photo",
      tone: hasPhoto ? ("ok" as const) : ("missing" as const),
      label: hasPhoto ? "On file" : "Missing",
    },
  ];

  const toneClass: Record<"ok" | "due" | "missing", string> = {
    ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    due: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    missing: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="compliance-snapshot">
      {items.map((item) => (
        <div
          key={item.key}
          className={`flex flex-col gap-1 rounded-lg border px-3 py-2 ${toneClass[item.tone]}`}
          data-testid={`compliance-${item.key}`}
        >
          <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide opacity-80">
            {item.tone === "ok" ? (
              <ShieldCheck className="h-3 w-3" />
            ) : (
              <ShieldAlert className="h-3 w-3" />
            )}
            {item.title}
          </span>
          <span className="text-sm font-semibold">
            {isLoading && item.key !== "photo" ? "…" : item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Current-assignment summary card shown at the top of the History tab. */
function CurrentAssignmentCard({
  crew,
  vesselName,
  reportsToName,
}: {
  crew: ViewingCrewMember;
  vesselName: string;
  reportsToName?: string | null;
}) {
  const rotation = formatRotation(crew.rotationOnDays, crew.rotationOffDays);
  const reliefDue = crew.contractEndDate
    ? format(new Date(crew.contractEndDate), "MMM d, yyyy")
    : null;
  return (
    <Card data-testid="card-current-assignment">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Ship className="h-4 w-4" />
          Current assignment
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Vessel</p>
            <p className="font-medium" data-testid="text-current-vessel">{vesselName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rotation</p>
            <p className="font-medium" data-testid="text-current-rotation">{rotation ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reports to</p>
            <p className="font-medium" data-testid="text-current-reports-to">{reportsToName || "Not set"}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> Relief / contract due
            </p>
            <p className="font-medium" data-testid="text-current-relief">{reliefDue ?? "Open-ended"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CREW_ADMIN_ROLES = ["super_admin", "system_admin", "company_admin", "admin"];

function CrewProfileTasksTab({ crewId, crewName }: { crewId: string; crewName: string }) {
  const { data: tasks = [], isLoading } = useCrewTasks({ assignedCrewId: crewId });
  const active = tasks.filter((t) => t.status !== "done");

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="text-crew-tasks-loading">
        Loading tasks…
      </p>
    );
  }

  if (active.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="text-crew-tasks-empty">
        No open tasks assigned to {crewName}.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="list-crew-profile-tasks">
      {active.map((task) => {
        const overdue = isOverdue(task);
        const due = dueLabel(task.dueDate);
        return (
          <div
            key={task.id}
            className="rounded-lg border p-3"
            data-testid={`row-crew-task-${task.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium" data-testid={`text-crew-task-title-${task.id}`}>
                {task.title}
              </p>
              <Badge variant="secondary" data-testid={`badge-crew-task-priority-${task.id}`}>
                {priorityLabel(task.priority)}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span data-testid={`text-crew-task-status-${task.id}`}>{statusLabel(task.status)}</span>
              {due && (
                <span className={overdue ? "text-destructive" : ""} data-testid={`text-crew-task-due-${task.id}`}>
                  {due}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CrewViewDialogContent({
  crew,
  vessels,
  initialTab = "details",
  reportsToName,
  canManage = false,
  onEdit,
  onAssign,
  onArchive,
}: CrewViewDialogContentProps) {
  const { hasAnyRole } = useRoleNames();
  const isAdmin = hasAnyRole(...CREW_ADMIN_ROLES);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const vesselName = vessels.find((v) => v.id === crew.vesselId)?.name || "Unassigned";
  const rotation = formatRotation(crew.rotationOnDays, crew.rotationOffDays);

  return (
    <div className="space-y-4">
      {/* Profile header — photo, identity, status chips, fast actions. */}
      <div className="flex flex-col gap-4 rounded-xl border bg-white/[0.02] p-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <CrewAvatar id={crew.id} name={crew.name} photoPath={crew.photoPath} />
          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPhotoModalOpen(true)}
              data-testid="button-change-photo"
            >
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              Change
            </Button>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-lg font-semibold" data-testid="text-profile-name">{crew.name}</p>
            <p className="text-sm text-muted-foreground" data-testid="text-profile-subtitle">
              {formatRank(crew.rank)} · {vesselName}
              {crew.crewCode ? ` · ${crew.crewCode}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={crew.active ? "default" : "secondary"} data-testid="chip-status">
              {crew.active ? crewStatusLabel(crew.status) : "Inactive"}
            </Badge>
            <Badge variant={crew.onDuty ? "default" : "outline"} data-testid="chip-duty">
              {crew.onDuty ? "On duty" : "Off duty"}
            </Badge>
            {crew.employmentType && (
              <Badge variant="outline" data-testid="chip-employment-type">
                {employmentTypeLabel(crew.employmentType)}
              </Badge>
            )}
            {rotation && (
              <Badge variant="outline" data-testid="chip-rotation">
                {rotation}
              </Badge>
            )}
          </div>
          {canManage && (onEdit || onAssign || onArchive) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {onEdit && (
                <Button type="button" size="sm" variant="secondary" onClick={onEdit} data-testid="button-profile-edit">
                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {onAssign && (
                <Button type="button" size="sm" variant="outline" onClick={onAssign} data-testid="button-profile-assign">
                  <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Assign
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActiveTab("notifications")}
                data-testid="button-profile-add-alert"
              >
                <Bell className="mr-1.5 h-3.5 w-3.5" /> Alerts
              </Button>
              {onArchive && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={onArchive}
                  data-testid="button-profile-archive"
                >
                  <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compliance snapshot — live document-derived status. */}
      <ComplianceSnapshot crewId={crew.id} hasPhoto={Boolean(crew.photoPath)} />

      <CrewPhotoModal
        crewId={crew.id}
        crewName={crew.name}
        photoPath={crew.photoPath}
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
      />

    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full flex-wrap h-auto">
        <TabsTrigger value="details" data-testid="tab-crew-details">
          <User className="h-4 w-4 mr-2" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="history" data-testid="tab-crew-history">
          <History className="h-4 w-4 mr-2" />
          History
        </TabsTrigger>
        <TabsTrigger value="documents" data-testid="tab-crew-documents">
          <FileText className="h-4 w-4 mr-2" />
          Docs & Certs
        </TabsTrigger>
        <TabsTrigger value="notifications" data-testid="tab-crew-notifications">
          <Bell className="h-4 w-4 mr-2" />
          Alerts
        </TabsTrigger>
        <TabsTrigger value="tasks" data-testid="tab-crew-tasks">
          <ListChecks className="h-4 w-4 mr-2" />
          Tasks
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="access" data-testid="tab-crew-access">
            <KeyRound className="h-4 w-4 mr-2" />
            Access & Login
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="details" className="mt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Rank</p>
            <p className="font-medium">{formatRank(crew.rank)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Vessel</p>
            <p className="font-medium">
              {vessels.find((v) => v.id === crew.vesselId)?.name || "Unassigned"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={crew.active ? "default" : "secondary"}>
              {crew.active ? crewStatusLabel(crew.status) : "Inactive"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Duty Status</p>
            <Badge variant={crew.onDuty ? "default" : "outline"}>
              {crew.onDuty ? "On Duty" : "Off Duty"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Max Hours/Week</p>
            <p className="font-medium">{crew.maxHours7d} hours</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Min Rest Required</p>
            <p className="font-medium">{crew.minRestH} hours</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Hourly Salary</p>
            <p className="font-medium" data-testid="text-crew-hourly-rate">
              {crew.hourlyRate ? `$${crew.hourlyRate.toFixed(2)}/hr` : "Not set"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Crew Code</p>
            <p className="font-medium" data-testid="text-crew-code">{crew.crewCode || "Not set"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Employment Type</p>
            <p className="font-medium" data-testid="text-employment-type">
              {employmentTypeLabel(crew.employmentType)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Reports To</p>
            <p className="font-medium" data-testid="text-reports-to">{reportsToName || "Not set"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Rotation</p>
            <p className="font-medium" data-testid="text-rotation">{rotation ?? "Not set"}</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Contact Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium" data-testid="text-crew-email">
                {crew.email || "Not set"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium" data-testid="text-crew-phone">
                {crew.phone || "Not set"}
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium" data-testid="text-crew-address">
                {crew.address || "Not set"}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Emergency Contact</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium" data-testid="text-emergency-name">
                {crew.emergencyContactName || "Not set"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium" data-testid="text-emergency-phone">
                {crew.emergencyContactPhone || "Not set"}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Contract Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Contract Start</p>
              <p className="font-medium" data-testid="text-start-date">
                {crew.startDate ? format(new Date(crew.startDate), "MMM d, yyyy") : "Not set"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Contract End</p>
              <p className="font-medium" data-testid="text-contract-end">
                {crew.contractEndDate
                  ? format(new Date(crew.contractEndDate), "MMM d, yyyy")
                  : "Not set"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cancellation Penalty</p>
              <p className="font-medium" data-testid="text-contract-penalty">
                {crew.contractPenalty ? `$${crew.contractPenalty.toFixed(2)}` : "Not set"}
              </p>
            </div>
          </div>
        </div>

        {crew.skills && crew.skills.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Skills</p>
            <div className="flex gap-2 flex-wrap">
              {crew.skills.map((skill: string) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </TabsContent>
      <TabsContent value="history" className="mt-4 space-y-4">
        <CurrentAssignmentCard
          crew={crew}
          vesselName={vesselName}
          reportsToName={reportsToName}
        />
        <EmploymentHistoryPanel crewId={crew.id} />
      </TabsContent>
      <TabsContent value="documents" className="mt-4">
        <CrewDocumentsTab crewId={crew.id} crewName={crew.name} />
      </TabsContent>
      <TabsContent value="notifications" className="mt-4">
        <CrewNotificationSettingsTab crewId={crew.id} crewName={crew.name} {...(crew.email != null && { crewEmail: crew.email })} />
      </TabsContent>
      <TabsContent value="tasks" className="mt-4">
        <CrewProfileTasksTab crewId={crew.id} crewName={crew.name} />
      </TabsContent>
      {isAdmin && (
        <TabsContent value="access" className="mt-4">
          <CrewAccessTab
            crewId={crew.id}
            crewName={crew.name}
            crewEmail={crew.email}
            crewVesselId={crew.vesselId}
          />
        </TabsContent>
      )}
    </Tabs>
    </div>
  );
}
