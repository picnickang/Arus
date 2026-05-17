// @ts-nocheck
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
} from "lucide-react";
import { CrewDocumentsTab } from "@/components/CrewDocumentsTab";
import { CrewNotificationSettingsTab } from "@/components/CrewNotificationSettingsTab";
import {
  useEmploymentHistory,
  useUpdateEmploymentHistory,
  useDeleteEmploymentHistory,
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
    setEditStartDate(record.startDate ? record.startDate.split("T")[0] : "");
    setEditEndDate(record.endDate ? record.endDate.split("T")[0] : "");
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
                <div className="grid grid-cols-2 gap-3">
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
}

interface CrewViewDialogContentProps {
  crew: ViewingCrewMember;
  vessels: Vessel[];
}

export function CrewViewDialogContent({ crew, vessels }: CrewViewDialogContentProps) {
  return (
    <Tabs defaultValue="details">
      <TabsList className="w-full">
        <TabsTrigger value="details" data-testid="tab-crew-details">
          <User className="h-4 w-4 mr-2" />
          Details
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
      </TabsList>
      <TabsContent value="details" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
              {crew.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Duty Status</p>
            <Badge variant={crew.onDuty ? "destructive" : "outline"}>
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
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Contact Information</h4>
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1 col-span-2">
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium" data-testid="text-crew-address">
                {crew.address || "Not set"}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Emergency Contact</h4>
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
      <TabsContent value="history" className="mt-4">
        <EmploymentHistoryPanel crewId={crew.id} />
      </TabsContent>
      <TabsContent value="documents" className="mt-4">
        <CrewDocumentsTab crewId={crew.id} />
      </TabsContent>
      <TabsContent value="notifications" className="mt-4">
        <CrewNotificationSettingsTab crewId={crew.id} />
      </TabsContent>
    </Tabs>
  );
}
