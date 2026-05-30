import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScheduledReportsSettingsData } from "@/features/settings";
import { useState, useEffect } from "react";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
];

export default function ScheduledReportsSettingsPage() {
  const {
    settings,
    isLoadingSettings,
    handleUpdateRetentionDays,
    handleUpdateDefaultTimezone,
    handleUpdateMaxRecipients,
    handleUpdateTimeout,
    updateSettingsMutation,
  } = useScheduledReportsSettingsData();

  const [retentionDays, setRetentionDays] = useState(settings.reportRetentionDays);
  const [maxRecipients, setMaxRecipients] = useState(settings.maxRecipientsPerSchedule);
  const [timeout, setTimeout] = useState(settings.reportGenerationTimeoutSeconds);

  useEffect(() => {
    setRetentionDays(settings.reportRetentionDays);
    setMaxRecipients(settings.maxRecipientsPerSchedule);
    setTimeout(settings.reportGenerationTimeoutSeconds);
  }, [settings]);

  if (isLoadingSettings) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-8">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/system-administration">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="p-2 bg-primary/10 rounded-lg">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Scheduled Reports Settings</h1>
          <p className="text-muted-foreground">
            Configure report generation and delivery preferences
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report Retention</CardTitle>
            <CardDescription>
              How long to keep generated reports before automatic cleanup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="retention-days" className="w-32">
                Retention Period
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="retention-days"
                  type="number"
                  min={1}
                  max={365}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  onBlur={() => {
                    if (
                      retentionDays !== settings.reportRetentionDays &&
                      retentionDays >= 1 &&
                      retentionDays <= 365
                    ) {
                      handleUpdateRetentionDays(retentionDays);
                    }
                  }}
                  className="w-24"
                  data-testid="input-retention-days"
                />
                <span className="text-muted-foreground">days</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Reports older than this will be automatically deleted. Valid range: 1-365 days.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Timezone</CardTitle>
            <CardDescription>Timezone used for scheduling new reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="timezone" className="w-32">
                Timezone
              </Label>
              <Select
                value={settings.defaultTimezone}
                onValueChange={(value) => handleUpdateDefaultTimezone(value)}
              >
                <SelectTrigger className="w-64" data-testid="select-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              This is the default timezone for new scheduled reports. Individual schedules can
              override this.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Recipients Limit</CardTitle>
            <CardDescription>
              Maximum number of email recipients per report schedule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="max-recipients" className="w-32">
                Max Recipients
              </Label>
              <Input
                id="max-recipients"
                type="number"
                min={1}
                max={50}
                value={maxRecipients}
                onChange={(e) => setMaxRecipients(Number(e.target.value))}
                onBlur={() => {
                  if (
                    maxRecipients !== settings.maxRecipientsPerSchedule &&
                    maxRecipients >= 1 &&
                    maxRecipients <= 50
                  ) {
                    handleUpdateMaxRecipients(maxRecipients);
                  }
                }}
                className="w-24"
                data-testid="input-max-recipients"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Limits the number of email addresses that can receive a single report. Valid range:
              1-50.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Timeout</CardTitle>
            <CardDescription>Maximum time allowed for report generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="timeout" className="w-32">
                Timeout
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="timeout"
                  type="number"
                  min={30}
                  max={600}
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                  onBlur={() => {
                    if (
                      timeout !== settings.reportGenerationTimeoutSeconds &&
                      timeout >= 30 &&
                      timeout <= 600
                    ) {
                      handleUpdateTimeout(timeout);
                    }
                  }}
                  className="w-24"
                  data-testid="input-timeout"
                />
                <span className="text-muted-foreground">seconds</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              If a report takes longer than this to generate, it will be marked as failed. Valid
              range: 30-600 seconds.
            </p>
          </CardContent>
        </Card>
      </div>

      {updateSettingsMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
          Saving...
        </div>
      )}
    </div>
  );
}
