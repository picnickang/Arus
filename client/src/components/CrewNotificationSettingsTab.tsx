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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Bell, AlertTriangle, FileText, Award, Save, Loader2 } from "lucide-react";

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
