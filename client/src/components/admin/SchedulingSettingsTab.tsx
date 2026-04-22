import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  Shield,
  Calendar,
  Sparkles,
  Send,
  ChevronDown,
  Plus,
  Trash2,
  Star,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  useSchedulingSettingsData,
  type NotificationSettings,
  type RuleThresholds,
  type RuleEnforcementSettings,
} from "@/features/settings/hooks/useSchedulingSettingsData";
import { cn } from "@/lib/utils";

const NOTIFICATION_EVENTS: Array<{
  key: keyof NotificationSettings;
  label: string;
  description: string;
}> = [
  {
    key: "schedulePublished",
    label: "Schedule Published",
    description: "When a new schedule is published",
  },
  {
    key: "assignmentChanged",
    label: "Assignment Changed",
    description: "When crew assignment is modified",
  },
  { key: "leaveApproved", label: "Leave Approved", description: "When leave request is approved" },
  {
    key: "conflictDetected",
    label: "Conflict Detected",
    description: "When scheduling conflict occurs",
  },
  {
    key: "certExpiring",
    label: "Certification Expiring",
    description: "When cert is about to expire",
  },
  { key: "rotationReminder", label: "Rotation Reminder", description: "Upcoming rotation change" },
];

const RULE_CONFIGS: Array<{
  key: keyof RuleEnforcementSettings;
  label: string;
  thresholdKey?: keyof RuleThresholds;
  thresholdLabel?: string;
  unit?: string;
  min?: number;
  max?: number;
}> = [
  {
    key: "restHours",
    label: "Minimum Rest Hours (24h)",
    thresholdKey: "minRestHours24h",
    thresholdLabel: "Hours",
    unit: "h",
    min: 6,
    max: 14,
  },
  {
    key: "maxWeekly",
    label: "Maximum Work Hours (7 days)",
    thresholdKey: "maxWorkHours7d",
    thresholdLabel: "Hours",
    unit: "h",
    min: 40,
    max: 100,
  },
  {
    key: "certification",
    label: "Certification Required",
    thresholdKey: "certExpiryWarningDays",
    thresholdLabel: "Warning days",
    unit: "days",
    min: 7,
    max: 90,
  },
  { key: "vesselMatch", label: "Vessel Assignment Match" },
  { key: "skillMatch", label: "Skill Requirements Match" },
  {
    key: "overlap",
    label: "Assignment Overlap Buffer",
    thresholdKey: "overlapBufferHours",
    thresholdLabel: "Buffer",
    unit: "h",
    min: 0,
    max: 24,
  },
];

function NotificationsSection() {
  const { settings, handleToggleNotification, updateNotificationsMutation } =
    useSchedulingSettingsData();
  const isSaving = updateNotificationsMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure who receives notifications for scheduling events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Event</TableHead>
              <TableHead className="text-center">Email</TableHead>
              <TableHead className="text-center">SMS</TableHead>
              <TableHead className="text-center">Push</TableHead>
              <TableHead className="text-center">In-App</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {NOTIFICATION_EVENTS.map(({ key, label, description }) => (
              <TableRow key={key}>
                <TableCell>
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={settings.notificationSettings[key].email}
                    onCheckedChange={(v) => handleToggleNotification(key, "email", v)}
                    disabled={isSaving}
                    data-testid={`switch-${key}-email`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={settings.notificationSettings[key].sms}
                    onCheckedChange={(v) => handleToggleNotification(key, "sms", v)}
                    disabled={isSaving}
                    data-testid={`switch-${key}-sms`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={settings.notificationSettings[key].push}
                    onCheckedChange={(v) => handleToggleNotification(key, "push", v)}
                    disabled={isSaving}
                    data-testid={`switch-${key}-push`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={settings.notificationSettings[key].inApp}
                    onCheckedChange={(v) => handleToggleNotification(key, "inApp", v)}
                    disabled={isSaving}
                    data-testid={`switch-${key}-inApp`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RulesSection() {
  const { settings, handleUpdateThreshold, handleToggleEnforcement, updateRulesMutation } =
    useSchedulingSettingsData();
  const isSaving = updateRulesMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Rules & Thresholds
        </CardTitle>
        <CardDescription>Configure STCW compliance rules and enforcement levels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {RULE_CONFIGS.map(({ key, label, thresholdKey, thresholdLabel, unit, min, max }) => (
          <div key={key} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{label}</span>
                <Button
                  variant={settings.ruleEnforcement[key] === "hard" ? "destructive" : "secondary"}
                  size="sm"
                  onClick={() => handleToggleEnforcement(key)}
                  disabled={isSaving}
                  className="h-6 text-xs"
                  data-testid={`button-enforcement-${key}`}
                >
                  {settings.ruleEnforcement[key] === "hard" ? (
                    <>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      HARD
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      SOFT
                    </>
                  )}
                </Button>
              </div>
              {thresholdKey && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">{thresholdLabel}:</span>
                  <Input
                    type="number"
                    value={settings.ruleThresholds[thresholdKey]}
                    onChange={(e) => handleUpdateThreshold(thresholdKey, Number(e.target.value))}
                    className="w-20 h-8"
                    min={min}
                    max={max}
                    disabled={isSaving}
                    data-testid={`input-threshold-${thresholdKey}`}
                  />
                  <span className="text-sm text-muted-foreground">{unit}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
          <div className="flex-1">
            <span className="font-medium">Max Onboard Days</span>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                value={settings.ruleThresholds.maxOnboardDays}
                onChange={(e) => handleUpdateThreshold("maxOnboardDays", Number(e.target.value))}
                className="w-20 h-8"
                min={30}
                max={180}
                disabled={isSaving}
                data-testid="input-threshold-maxOnboardDays"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RotationTemplatesSection() {
  const {
    settings,
    handleAddTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleSetDefaultTemplate,
    updateRotationTemplatesMutation,
  } = useSchedulingSettingsData();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", onDays: 28, offDays: 28 });
  const isSaving = updateRotationTemplatesMutation.isPending;

  const handleAdd = () => {
    if (newTemplate.name.trim()) {
      handleAddTemplate({ ...newTemplate, isDefault: false });
      setNewTemplate({ name: "", onDays: 28, offDays: 28 });
      setIsAddingNew(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Rotation Templates
        </CardTitle>
        <CardDescription>Define crew rotation patterns (on/off cycles)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {settings.rotationTemplates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between gap-4 p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              {template.isDefault && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
              <div>
                <div className="font-medium">{template.name}</div>
                <div className="text-sm text-muted-foreground">
                  {template.onDays} days on / {template.offDays} days off
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!template.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetDefaultTemplate(template.id)}
                  disabled={isSaving}
                  data-testid={`button-set-default-${template.id}`}
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteTemplate(template.id)}
                disabled={isSaving || settings.rotationTemplates.length <= 1}
                data-testid={`button-delete-template-${template.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {isAddingNew ? (
          <div className="p-3 border rounded-lg space-y-3">
            <Input
              placeholder="Template name (e.g., 42/21)"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              data-testid="input-template-name"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">On Days</Label>
                <Input
                  type="number"
                  value={newTemplate.onDays}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, onDays: Number(e.target.value) })
                  }
                  min={1}
                  max={120}
                  data-testid="input-template-onDays"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Off Days</Label>
                <Input
                  type="number"
                  value={newTemplate.offDays}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, offDays: Number(e.target.value) })
                  }
                  min={1}
                  max={120}
                  data-testid="input-template-offDays"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newTemplate.name.trim() || isSaving}
                data-testid="button-save-template"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddingNew(false)}
                data-testid="button-cancel-template"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsAddingNew(true)}
            data-testid="button-add-template"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AiWeightsSection() {
  const {
    settings,
    aiWeightsOpen,
    setAiWeightsOpen,
    handleUpdateAiWeight,
    updateAiWeightsMutation,
  } = useSchedulingSettingsData();
  const isSaving = updateAiWeightsMutation.isPending;

  const weights: Array<{
    key: keyof typeof settings.aiWeights;
    label: string;
    description: string;
  }> = [
    {
      key: "skillMatch",
      label: "Skill Match",
      description: "How well crew skills match requirements",
    },
    { key: "availability", label: "Availability", description: "Rest periods and schedule gaps" },
    { key: "fatigue", label: "Fatigue Score", description: "Recent workload and fatigue levels" },
    { key: "experience", label: "Experience", description: "Vessel and role experience" },
    { key: "preference", label: "Preference", description: "Crew preferences and requests" },
  ];

  return (
    <Collapsible open={aiWeightsOpen} onOpenChange={setAiWeightsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Suggestion Weights
              </div>
              <ChevronDown
                className={cn("h-5 w-5 transition-transform", aiWeightsOpen && "rotate-180")}
              />
            </CardTitle>
            <CardDescription>
              Configure how AI ranks crew suggestions (explanations only, not decisions)
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              These weights affect how AI explains crew suggestions. All constraint checking and
              ranking remains deterministic.
            </div>
            {weights.map(({ key, label, description }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Badge variant="outline">{settings.aiWeights[key]}%</Badge>
                </div>
                <Slider
                  value={[settings.aiWeights[key]]}
                  onValueChange={([v]) => handleUpdateAiWeight(key, v)}
                  min={0}
                  max={100}
                  step={5}
                  disabled={isSaving}
                  data-testid={`slider-weight-${key}`}
                />
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function PublishBehaviorSection() {
  const { settings, handleTogglePublishBehavior, updatePublishBehaviorMutation } =
    useSchedulingSettingsData();
  const isSaving = updatePublishBehaviorMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Publish Behavior
        </CardTitle>
        <CardDescription>Configure how schedules are published and archived</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Require Approval</Label>
            <p className="text-xs text-muted-foreground">
              Schedules must be approved before publishing
            </p>
          </div>
          <Switch
            checked={settings.publishBehavior.requireApproval}
            onCheckedChange={(v) => handleTogglePublishBehavior("requireApproval", v)}
            disabled={isSaving}
            data-testid="switch-requireApproval"
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Notify on Publish</Label>
            <p className="text-xs text-muted-foreground">
              Send notifications when schedule is published
            </p>
          </div>
          <Switch
            checked={settings.publishBehavior.notifyOnPublish}
            onCheckedChange={(v) => handleTogglePublishBehavior("notifyOnPublish", v)}
            disabled={isSaving}
            data-testid="switch-notifyOnPublish"
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Lock After Publish</Label>
            <p className="text-xs text-muted-foreground">Prevent changes to published schedules</p>
          </div>
          <Switch
            checked={settings.publishBehavior.lockAfterPublish}
            onCheckedChange={(v) => handleTogglePublishBehavior("lockAfterPublish", v)}
            disabled={isSaving}
            data-testid="switch-lockAfterPublish"
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Auto Archive</Label>
            <p className="text-xs text-muted-foreground">Automatically archive old schedules</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={settings.publishBehavior.autoArchiveDays}
              onChange={(e) =>
                handleTogglePublishBehavior("autoArchiveDays", Number(e.target.value))
              }
              className="w-20 h-8"
              min={30}
              max={365}
              disabled={isSaving}
              data-testid="input-autoArchiveDays"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SchedulingSettingsTab() {
  const { isLoadingSettings } = useSchedulingSettingsData();

  if (isLoadingSettings) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="h-32 animate-pulse bg-muted" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="scheduling-settings-tab">
      <div>
        <h3 className="text-lg font-medium">Scheduling Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure crew scheduling rules, notifications, and AI suggestion preferences.
        </p>
      </div>

      <NotificationsSection />
      <RulesSection />
      <RotationTemplatesSection />
      <AiWeightsSection />
      <PublishBehaviorSection />
    </div>
  );
}
