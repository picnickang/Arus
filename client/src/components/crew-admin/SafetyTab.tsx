import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ALARM_SEVERITIES,
  ALARM_MODES,
  ALARM_SAFETY_NOTE,
  CONFIRM_REQUIRED_SEVERITIES,
  type AlarmSeverity,
} from "@shared/role-dashboard";
import { Plus, Trash2, ShieldAlert, BellOff, Pencil, History } from "lucide-react";
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

interface AlarmType {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  defaultSeverity: string;
  requiresAcknowledgement: boolean;
  isProtected: boolean;
  isActive: boolean;
}

interface AlarmAck {
  id: string;
  userId: string;
  userName: string | null;
  acknowledgedAt: string | null;
}

interface ActiveAlarm {
  id: string;
  alarmTypeId: string;
  vesselId: string | null;
  title: string;
  message: string | null;
  severity: string;
  mode: string;
  status: string;
  requiresAcknowledgement: boolean;
  triggeredByName: string | null;
  triggeredAt: string | null;
  clearedByName: string | null;
  clearedAt: string | null;
  acknowledgements?: AlarmAck[];
}

interface VesselLite {
  id: string;
  name: string;
}

function useToastError() {
  const { toast } = useToast();
  return (error: unknown) =>
    toast({
      title: "Action failed",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });
}

function AlarmTypesSection() {
  const { toast } = useToast();
  const onError = useToastError();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: "",
    displayName: "",
    description: "",
    defaultSeverity: "warning" as string,
    requiresAcknowledgement: true,
  });
  const [editForm, setEditForm] = useState({
    displayName: "",
    description: "",
    defaultSeverity: "warning" as string,
    requiresAcknowledgement: true,
  });

  const { data: types = [] } = useQuery<AlarmType[]>({
    queryKey: ["/api/admin/safety-alarm-types"],
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/safety-alarm-types"] });

  const create = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/safety-alarm-types", {
        key: form.key.trim(),
        displayName: form.displayName.trim(),
        description: form.description.trim() || undefined,
        defaultSeverity: form.defaultSeverity,
        requiresAcknowledgement: form.requiresAcknowledgement,
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setForm({
        key: "",
        displayName: "",
        description: "",
        defaultSeverity: "warning",
        requiresAcknowledgement: true,
      });
      toast({ title: "Alarm type created" });
    },
    onError,
  });

  const toggleActive = useMutation({
    mutationFn: (t: AlarmType) =>
      apiRequest("PATCH", `/api/admin/safety-alarm-types/${t.id}`, {
        isActive: !t.isActive,
      }),
    onSuccess: invalidate,
    onError,
  });

  const update = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/safety-alarm-types/${id}`, {
        displayName: editForm.displayName.trim(),
        description: editForm.description.trim(),
        defaultSeverity: editForm.defaultSeverity,
        requiresAcknowledgement: editForm.requiresAcknowledgement,
      }),
    onSuccess: () => {
      invalidate();
      setEditId(null);
      toast({ title: "Alarm type updated" });
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/safety-alarm-types/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Alarm type deleted" });
    },
    onError,
  });

  return (
    <Card data-testid="section-alarm-types">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Alarm Types</CardTitle>
          <CardDescription>Define the emergency notice types crews can be alerted with.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-add-alarm-type">
          <Plus className="h-4 w-4 mr-1" /> Add Type
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Ack</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => (
              <TableRow key={t.id} data-testid={`row-alarm-type-${t.id}`}>
                <TableCell>
                  <div className="font-medium">{t.displayName}</div>
                  <div className="text-xs text-muted-foreground">{t.key}</div>
                  {t.isProtected && (
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      Protected
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="capitalize">{t.defaultSeverity}</TableCell>
                <TableCell>{t.requiresAcknowledgement ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Switch
                    checked={t.isActive}
                    onCheckedChange={() => toggleActive.mutate(t)}
                    data-testid={`switch-alarm-type-active-${t.id}`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditId(t.id);
                      setEditForm({
                        displayName: t.displayName,
                        description: t.description ?? "",
                        defaultSeverity: t.defaultSeverity,
                        requiresAcknowledgement: t.requiresAcknowledgement,
                      });
                    }}
                    data-testid={`button-edit-alarm-type-${t.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={t.isProtected}
                    onClick={() => remove.mutate(t.id)}
                    data-testid={`button-delete-alarm-type-${t.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {types.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No alarm types defined yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Alarm Type</DialogTitle>
            <DialogDescription>Lowercase key with underscores, e.g. fire_alarm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="alarm-type-key">Key</Label>
              <Input
                id="alarm-type-key"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="fire_alarm"
                data-testid="input-alarm-type-key"
              />
            </div>
            <div>
              <Label htmlFor="alarm-type-name">Display name</Label>
              <Input
                id="alarm-type-name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                data-testid="input-alarm-type-name"
              />
            </div>
            <div>
              <Label htmlFor="alarm-type-desc">Description</Label>
              <Textarea
                id="alarm-type-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="input-alarm-type-desc"
              />
            </div>
            <div>
              <Label>Default severity</Label>
              <Select
                value={form.defaultSeverity}
                onValueChange={(v) => setForm({ ...form, defaultSeverity: v })}
              >
                <SelectTrigger data-testid="select-alarm-type-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALARM_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="alarm-type-ack">Requires acknowledgement</Label>
              <Switch
                id="alarm-type-ack"
                checked={form.requiresAcknowledgement}
                onCheckedChange={(v) => setForm({ ...form, requiresAcknowledgement: v })}
                data-testid="switch-alarm-type-ack"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending || !form.key.trim() || !form.displayName.trim()
              }
              data-testid="button-save-alarm-type"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editId !== null} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Alarm Type</DialogTitle>
            <DialogDescription>The internal key cannot be changed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-alarm-type-name">Display name</Label>
              <Input
                id="edit-alarm-type-name"
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                data-testid="input-edit-alarm-type-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-alarm-type-desc">Description</Label>
              <Textarea
                id="edit-alarm-type-desc"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                data-testid="input-edit-alarm-type-desc"
              />
            </div>
            <div>
              <Label>Default severity</Label>
              <Select
                value={editForm.defaultSeverity}
                onValueChange={(v) => setEditForm({ ...editForm, defaultSeverity: v })}
              >
                <SelectTrigger data-testid="select-edit-alarm-type-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALARM_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-alarm-type-ack">Requires acknowledgement</Label>
              <Switch
                id="edit-alarm-type-ack"
                checked={editForm.requiresAcknowledgement}
                onCheckedChange={(v) =>
                  setEditForm({ ...editForm, requiresAcknowledgement: v })
                }
                data-testid="switch-edit-alarm-type-ack"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => editId && update.mutate(editId)}
              disabled={update.isPending || !editForm.displayName.trim()}
              data-testid="button-save-edit-alarm-type"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ActiveAlarmsSection() {
  const { toast } = useToast();
  const onError = useToastError();
  const [open, setOpen] = useState(false);
  const [showCleared, setShowCleared] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setForm] = useState({
    alarmTypeId: "",
    vesselId: "__fleet__",
    title: "",
    message: "",
    severity: "warning" as string,
    mode: "real" as string,
  });

  const { data: types = [] } = useQuery<AlarmType[]>({
    queryKey: ["/api/admin/safety-alarm-types"],
  });
  const { data: alarms = [] } = useQuery<ActiveAlarm[]>({
    queryKey: ["/api/admin/safety-alarms", { includeCleared: showCleared }],
    queryFn: () =>
      apiRequest<ActiveAlarm[]>(
        "GET",
        `/api/admin/safety-alarms${showCleared ? "?includeCleared=true" : ""}`,
      ),
    refetchInterval: 20000,
  });
  const { data: vessels = [] } = useQuery<VesselLite[]>({ queryKey: ["/api/vessels"] });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/safety-alarms"] });

  const trigger = useMutation({
    mutationFn: (confirmed: boolean) =>
      apiRequest("POST", "/api/admin/safety-alarms", {
        alarmTypeId: form.alarmTypeId,
        vesselId: form.vesselId === "__fleet__" ? undefined : form.vesselId,
        title: form.title.trim() || undefined,
        message: form.message.trim() || undefined,
        severity: form.severity,
        mode: form.mode,
        confirmed,
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Alarm activated" });
    },
    onError,
  });

  const clear = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/admin/safety-alarms/${id}/clear`, {}),
    onSuccess: () => {
      invalidate();
      toast({ title: "Alarm cleared" });
    },
    onError,
  });

  const needsConfirm =
    form.mode === "real" &&
    CONFIRM_REQUIRED_SEVERITIES.includes(form.severity as AlarmSeverity);

  function activate() {
    if (needsConfirm) {
      setConfirmOpen(true);
      return;
    }
    trigger.mutate(true);
  }

  const activeTypes = types.filter((t) => t.isActive);

  return (
    <Card data-testid="section-active-alarms">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Active Alarms</CardTitle>
          <CardDescription>{ALARM_SAFETY_NOTE}</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            Show cleared
            <Switch
              checked={showCleared}
              onCheckedChange={setShowCleared}
              data-testid="switch-show-cleared-alarms"
            />
          </label>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setOpen(true)}
            disabled={activeTypes.length === 0}
            data-testid="button-trigger-alarm"
          >
            <ShieldAlert className="h-4 w-4 mr-1" /> Activate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alarm</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Acks</TableHead>
              <TableHead>Triggered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alarms.map((a) => {
              const vessel = vessels.find((v) => v.id === a.vesselId);
              return (
                <TableRow key={a.id} data-testid={`row-active-alarm-${a.id}`}>
                  <TableCell>
                    <div className="font-medium">{a.title}</div>
                    <Badge variant="outline" className="text-[10px] capitalize mt-1">
                      {a.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.vesselId ? vessel?.name ?? a.vesselId : "Fleet-wide"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={a.mode === "real" ? "destructive" : "secondary"}
                      className="text-[10px] uppercase"
                    >
                      {a.mode}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-ack-count-${a.id}`}>
                    {a.requiresAcknowledgement
                      ? `${a.acknowledgements?.length ?? 0} ack'd`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.triggeredByName ?? "—"}
                    {a.triggeredAt
                      ? ` · ${new Date(a.triggeredAt).toLocaleString()}`
                      : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status === "cleared" ? (
                      <span
                        className="text-xs text-muted-foreground"
                        data-testid={`text-cleared-info-${a.id}`}
                      >
                        Cleared{a.clearedByName ? ` by ${a.clearedByName}` : ""}
                        {a.clearedAt
                          ? ` · ${new Date(a.clearedAt).toLocaleString()}`
                          : ""}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clear.mutate(a.id)}
                        data-testid={`button-clear-alarm-${a.id}`}
                      >
                        <BellOff className="h-4 w-4 mr-1" /> Clear
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {alarms.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {showCleared ? "No alarms on record." : "No active alarms."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Alarm</DialogTitle>
            <DialogDescription>{ALARM_SAFETY_NOTE}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Alarm type</Label>
              <Select
                value={form.alarmTypeId}
                onValueChange={(v) => {
                  const t = activeTypes.find((x) => x.id === v);
                  setForm({
                    ...form,
                    alarmTypeId: v,
                    severity: t?.defaultSeverity ?? form.severity,
                    title: t?.displayName ?? form.title,
                  });
                }}
              >
                <SelectTrigger data-testid="select-alarm-type">
                  <SelectValue placeholder="Select alarm type" />
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scope</Label>
              <Select
                value={form.vesselId}
                onValueChange={(v) => setForm({ ...form, vesselId: v })}
              >
                <SelectTrigger data-testid="select-alarm-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__fleet__">Fleet-wide</SelectItem>
                  {vessels.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="alarm-title">Title</Label>
              <Input
                id="alarm-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                data-testid="input-alarm-title"
              />
            </div>
            <div>
              <Label htmlFor="alarm-message">Message</Label>
              <Textarea
                id="alarm-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                data-testid="input-alarm-message"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Severity</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v })}
                >
                  <SelectTrigger data-testid="select-alarm-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALARM_SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger data-testid="select-alarm-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALARM_MODES.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={activate}
              disabled={trigger.isPending || !form.alarmTypeId}
              data-testid="button-confirm-trigger"
            >
              {needsConfirm ? "Confirm & Activate" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate a REAL alarm?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to activate a real {form.severity.toUpperCase()} alarm. This
              immediately notifies affected crews. Continue only if this is a genuine event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-real-alarm">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                trigger.mutate(true);
              }}
              data-testid="button-confirm-real-alarm"
            >
              Activate alarm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function SafetyTab() {
  return (
    <div className="space-y-6" data-testid="tab-content-safety">
      <ActiveAlarmsSection />
      <AlarmTypesSection />
    </div>
  );
}
