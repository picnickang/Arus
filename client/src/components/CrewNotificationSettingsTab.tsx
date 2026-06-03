import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mail,
  Bell,
  AlertTriangle,
  FileText,
  Award,
  Save,
  Loader2,
  CheckCircle,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { useCertificationExpiryData, useCrewDocumentsData } from "@/features/crew";

type CrewAlertEntry = {
  id: string;
  kind: "cert" | "doc";
  title: string;
  detail: string;
  level: "expired" | "critical" | "warning" | "notice";
  days: number;
  acknowledged: boolean;
};

const LEVEL_CLASS: Record<CrewAlertEntry["level"], string> = {
  expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  notice: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

/**
 * Read-only log of the crew member's live expiry alerts. Certification alerts
 * come from the org-wide expiring-certs feed (filtered to this crew) and carry a
 * real acknowledge action; document alerts are derived from the crew's documents
 * and are managed (renewed) from the Documents tab.
 */
function CrewAlertLog({ crewId }: { crewId: string }) {
  const certData = useCertificationExpiryData({ daysAhead: 365 });
  const { documents, getExpiryStatus, getDocumentTypeLabel, isLoading: docsLoading } =
    useCrewDocumentsData(crewId);

  const certAlerts: CrewAlertEntry[] = (certData.data?.certifications ?? [])
    .filter((c) => c.crewId === crewId)
    .map((c) => ({
      id: c.id,
      kind: "cert" as const,
      title: c.cert,
      detail:
        c.daysUntilExpiry <= 0
          ? `Expired ${format(new Date(c.expiresAt), "MMM d, yyyy")}`
          : `Expires in ${c.daysUntilExpiry}d · ${format(new Date(c.expiresAt), "MMM d, yyyy")}`,
      level: c.daysUntilExpiry <= 0 ? "expired" : c.urgencyLevel,
      days: c.daysUntilExpiry,
      acknowledged: Boolean(c.alertAcknowledged),
    }));

  const docAlerts: CrewAlertEntry[] = documents
    .map((doc) => ({ doc, status: getExpiryStatus(doc.expiresAt) }))
    .filter(
      (x): x is { doc: (typeof documents)[number]; status: NonNullable<ReturnType<typeof getExpiryStatus>> } =>
        Boolean(x.status) && x.status?.level !== "ok"
    )
    .map(({ doc, status }) => ({
      id: doc.id,
      kind: "doc" as const,
      title: getDocumentTypeLabel(doc.documentType),
      detail: doc.expiresAt
        ? status.level === "expired"
          ? `Expired ${format(new Date(doc.expiresAt), "MMM d, yyyy")}`
          : `Expires ${format(new Date(doc.expiresAt), "MMM d, yyyy")}`
        : "No expiry on file",
      level: status.level as CrewAlertEntry["level"],
      days: 0,
      acknowledged: Boolean(doc.alertAcknowledged),
    }));

  const entries = [...certAlerts, ...docAlerts].sort(
    (a, b) => Number(a.acknowledged) - Number(b.acknowledged) || a.days - b.days
  );

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-medium">Alert Log</Label>
          <Badge variant="secondary" className="ml-auto" data-testid="badge-alert-count">
            {entries.filter((e) => !e.acknowledged).length} active
          </Badge>
        </div>

        {certData.isLoading || docsLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : entries.length === 0 ? (
          <p
            className="py-3 text-center text-sm text-muted-foreground"
            data-testid="text-no-alerts"
          >
            No active alerts for this crew member.
          </p>
        ) : (
          <div className="space-y-2" data-testid="list-crew-alerts">
            {entries.map((entry) => (
              <div
                key={`${entry.kind}-${entry.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                data-testid={`alert-entry-${entry.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {entry.kind === "cert" ? (
                      <Award className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    )}
                    <span className="truncate text-sm font-medium">{entry.title}</span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${LEVEL_CLASS[entry.level]}`}
                    >
                      {entry.level === "expired" ? "Expired" : entry.level}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p>
                </div>
                {entry.acknowledged ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 text-emerald-600"
                    data-testid={`alert-ack-${entry.id}`}
                  >
                    <CheckCircle className="h-3 w-3" /> Acknowledged
                  </Badge>
                ) : entry.kind === "cert" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      const cert = certData.data?.certifications.find((c) => c.id === entry.id);
                      if (cert) {
                        certData.handleAcknowledge(cert);
                      }
                    }}
                    data-testid={`button-ack-alert-${entry.id}`}
                  >
                    Acknowledge
                  </Button>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">See Documents</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={certData.acknowledgeDialogOpen} onOpenChange={certData.setAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Alert</DialogTitle>
            <DialogDescription>
              Confirm you have actioned the expiry for{" "}
              {certData.selectedCert?.cert ?? "this certification"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ack-notes" className="text-sm">
              Notes (optional)
            </Label>
            <Textarea
              id="ack-notes"
              value={certData.acknowledgeNotes}
              onChange={(e) => certData.setAcknowledgeNotes(e.target.value)}
              placeholder="e.g. renewal submitted, awaiting issue"
              data-testid="input-ack-notes"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => certData.setAcknowledgeDialogOpen(false)}
              data-testid="button-cancel-ack"
            >
              Cancel
            </Button>
            <Button
              onClick={certData.confirmAcknowledge}
              disabled={certData.isAcknowledging}
              data-testid="button-confirm-ack"
            >
              {certData.isAcknowledging ? "Saving…" : "Acknowledge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface CrewNotificationSettingsTabProps {
  crewId: string;
  crewName: string;
  crewEmail?: string | null;
}

interface NotificationSettings {
  crewId: string;
  orgId: string;
  emailAlertsEnabled: boolean;
  certExpiryEmailEnabled: boolean;
  documentExpiryEmailEnabled: boolean;
  complianceEmailEnabled: boolean;
  overrideEmail: string | null;
}

export function CrewNotificationSettingsTab({
  crewId,
  crewName,
  crewEmail,
}: CrewNotificationSettingsTabProps) {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<NotificationSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/crew", crewId, "notification-settings"],
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<NotificationSettings>) => {
      return apiRequest("PUT", `/api/crew/${crewId}/notification-settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "notification-settings"] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: `Notification preferences for ${crewName} have been updated.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save notification settings.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (field: keyof NotificationSettings, value: boolean) => {
    if (!localSettings) {
      return;
    }
    setLocalSettings({ ...localSettings, [field]: value });
    setHasChanges(true);
  };

  const handleOverrideEmailChange = (value: string) => {
    if (!localSettings) {
      return;
    }
    setLocalSettings({ ...localSettings, overrideEmail: value || null });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!localSettings) {
      return;
    }
    updateMutation.mutate({
      emailAlertsEnabled: localSettings.emailAlertsEnabled,
      certExpiryEmailEnabled: localSettings.certExpiryEmailEnabled,
      documentExpiryEmailEnabled: localSettings.documentExpiryEmailEnabled,
      complianceEmailEnabled: localSettings.complianceEmailEnabled,
      overrideEmail: localSettings.overrideEmail,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const effectiveEmail = localSettings?.overrideEmail || crewEmail;

  return (
    <div className="space-y-4">
      <CrewAlertLog crewId={crewId} />

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Email Address</Label>
            </div>
            {effectiveEmail ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {effectiveEmail}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not configured
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="override-email" className="text-sm text-muted-foreground">
              Override Email (optional)
            </Label>
            <Input
              id="override-email"
              type="email"
              placeholder="Send alerts to a different email address"
              value={localSettings?.overrideEmail || ""}
              onChange={(e) => handleOverrideEmailChange(e.target.value)}
              data-testid="input-override-email"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the crew member's primary email address.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-base font-medium">Email Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Master switch for all email notifications
                </p>
              </div>
            </div>
            <Switch
              checked={localSettings?.emailAlertsEnabled ?? true}
              onCheckedChange={(checked) => handleToggle("emailAlertsEnabled", checked)}
              data-testid="switch-email-alerts-enabled"
            />
          </div>

          <Separator />

          <div className={`space-y-4 ${!localSettings?.emailAlertsEnabled ? "opacity-50" : ""}`}>
            <h4 className="text-sm font-medium text-muted-foreground">Alert Types</h4>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-500" />
                <div>
                  <Label className="text-sm">Certification Expiry</Label>
                  <p className="text-xs text-muted-foreground">
                    Alerts when certifications are about to expire
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings?.certExpiryEmailEnabled ?? true}
                onCheckedChange={(checked) => handleToggle("certExpiryEmailEnabled", checked)}
                disabled={!localSettings?.emailAlertsEnabled}
                data-testid="switch-cert-expiry-enabled"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-500" />
                <div>
                  <Label className="text-sm">Document Expiry</Label>
                  <p className="text-xs text-muted-foreground">
                    Alerts when documents are about to expire
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings?.documentExpiryEmailEnabled ?? true}
                onCheckedChange={(checked) => handleToggle("documentExpiryEmailEnabled", checked)}
                disabled={!localSettings?.emailAlertsEnabled}
                data-testid="switch-document-expiry-enabled"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <div>
                  <Label className="text-sm">Compliance Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Alerts for STCW/MLC compliance issues
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings?.complianceEmailEnabled ?? true}
                onCheckedChange={(checked) => handleToggle("complianceEmailEnabled", checked)}
                disabled={!localSettings?.emailAlertsEnabled}
                data-testid="switch-compliance-enabled"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-notification-settings"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      )}

      {!localSettings?.emailAlertsEnabled && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Email alerts are disabled. Enable the master switch above to configure individual alert
          types.
        </p>
      )}
    </div>
  );
}
