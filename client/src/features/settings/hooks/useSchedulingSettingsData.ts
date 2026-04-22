import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface NotificationRecipient {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
}

export interface NotificationSettings {
  schedulePublished: NotificationRecipient;
  assignmentChanged: NotificationRecipient;
  leaveApproved: NotificationRecipient;
  conflictDetected: NotificationRecipient;
  certExpiring: NotificationRecipient;
  rotationReminder: NotificationRecipient;
}

export interface RuleThresholds {
  maxOnboardDays: number;
  minRestHours24h: number;
  maxWorkHours7d: number;
  certExpiryWarningDays: number;
  overlapBufferHours: number;
}

export interface RuleEnforcementSettings {
  restHours: "hard" | "soft";
  maxWeekly: "hard" | "soft";
  certification: "hard" | "soft";
  vesselMatch: "hard" | "soft";
  skillMatch: "hard" | "soft";
  overlap: "hard" | "soft";
}

export interface AiWeights {
  skillMatch: number;
  availability: number;
  fatigue: number;
  experience: number;
  preference: number;
}

export interface PublishBehavior {
  requireApproval: boolean;
  notifyOnPublish: boolean;
  lockAfterPublish: boolean;
  autoArchiveDays: number;
}

export interface RotationTemplate {
  id: string;
  name: string;
  onDays: number;
  offDays: number;
  isDefault: boolean;
}

export interface SchedulingSettingsData {
  id: string;
  orgId: string;
  vesselId: string | null;
  notificationSettings: NotificationSettings;
  ruleThresholds: RuleThresholds;
  ruleEnforcement: RuleEnforcementSettings;
  aiWeights: AiWeights;
  publishBehavior: PublishBehavior;
  rotationTemplates: RotationTemplate[];
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  schedulePublished: { email: true, sms: false, push: true, inApp: true },
  assignmentChanged: { email: true, sms: false, push: true, inApp: true },
  leaveApproved: { email: true, sms: false, push: false, inApp: true },
  conflictDetected: { email: true, sms: true, push: true, inApp: true },
  certExpiring: { email: true, sms: false, push: true, inApp: true },
  rotationReminder: { email: true, sms: false, push: true, inApp: true },
};

const DEFAULT_RULE_THRESHOLDS: RuleThresholds = {
  maxOnboardDays: 90,
  minRestHours24h: 10,
  maxWorkHours7d: 77,
  certExpiryWarningDays: 30,
  overlapBufferHours: 4,
};

const DEFAULT_RULE_ENFORCEMENT: RuleEnforcementSettings = {
  restHours: "hard",
  maxWeekly: "hard",
  certification: "hard",
  vesselMatch: "soft",
  skillMatch: "soft",
  overlap: "soft",
};

const DEFAULT_AI_WEIGHTS: AiWeights = {
  skillMatch: 30,
  availability: 25,
  fatigue: 20,
  experience: 15,
  preference: 10,
};

const DEFAULT_PUBLISH_BEHAVIOR: PublishBehavior = {
  requireApproval: true,
  notifyOnPublish: true,
  lockAfterPublish: true,
  autoArchiveDays: 90,
};

const DEFAULT_ROTATION_TEMPLATES: RotationTemplate[] = [
  { id: "1", name: "28/28", onDays: 28, offDays: 28, isDefault: true },
  { id: "2", name: "35/35", onDays: 35, offDays: 35, isDefault: false },
];

export function useSchedulingSettingsData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [aiWeightsOpen, setAiWeightsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RotationTemplate | null>(null);

  const { data: settings, isLoading: isLoadingSettings } = useQuery<SchedulingSettingsData>({
    queryKey: ["/api/scheduling-settings"],
  });

  const effectiveSettings: SchedulingSettingsData = settings || {
    id: "",
    orgId: "",
    vesselId: null,
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    ruleThresholds: DEFAULT_RULE_THRESHOLDS,
    ruleEnforcement: DEFAULT_RULE_ENFORCEMENT,
    aiWeights: DEFAULT_AI_WEIGHTS,
    publishBehavior: DEFAULT_PUBLISH_BEHAVIOR,
    rotationTemplates: DEFAULT_ROTATION_TEMPLATES,
  };

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: NotificationSettings) => {
      return apiRequest("/api/scheduling-settings/notifications", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      toast({
        title: "Notifications Updated",
        description: "Notification settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notification settings.",
        variant: "destructive",
      });
    },
  });

  const updateRulesMutation = useMutation({
    mutationFn: async (data: {
      thresholds: RuleThresholds;
      enforcement: RuleEnforcementSettings;
    }) => {
      return apiRequest("/api/scheduling-settings/rules", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      toast({ title: "Rules Updated", description: "Rule settings have been saved." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update rule settings.",
        variant: "destructive",
      });
    },
  });

  const updateAiWeightsMutation = useMutation({
    mutationFn: async (data: AiWeights) => {
      return apiRequest("/api/scheduling-settings/ai-weights", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      toast({ title: "AI Weights Updated", description: "AI suggestion weights have been saved." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update AI weights.",
        variant: "destructive",
      });
    },
  });

  const updatePublishBehaviorMutation = useMutation({
    mutationFn: async (data: PublishBehavior) => {
      return apiRequest("/api/scheduling-settings/publish-behavior", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      toast({
        title: "Publish Behavior Updated",
        description: "Publish settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update publish behavior.",
        variant: "destructive",
      });
    },
  });

  const updateRotationTemplatesMutation = useMutation({
    mutationFn: async (data: RotationTemplate[]) => {
      return apiRequest("/api/scheduling-settings/rotation-templates", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      toast({ title: "Templates Updated", description: "Rotation templates have been saved." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update rotation templates.",
        variant: "destructive",
      });
    },
  });

  const handleToggleNotification = (
    event: keyof NotificationSettings,
    channel: keyof NotificationRecipient,
    value: boolean
  ) => {
    const updated = {
      ...effectiveSettings.notificationSettings,
      [event]: {
        ...effectiveSettings.notificationSettings[event],
        [channel]: value,
      },
    };
    updateNotificationsMutation.mutate(updated);
  };

  const handleUpdateThreshold = (key: keyof RuleThresholds, value: number) => {
    const updated = {
      thresholds: { ...effectiveSettings.ruleThresholds, [key]: value },
      enforcement: effectiveSettings.ruleEnforcement,
    };
    updateRulesMutation.mutate(updated);
  };

  const handleToggleEnforcement = (key: keyof RuleEnforcementSettings) => {
    const current = effectiveSettings.ruleEnforcement[key];
    const updated = {
      thresholds: effectiveSettings.ruleThresholds,
      enforcement: {
        ...effectiveSettings.ruleEnforcement,
        [key]: current === "hard" ? "soft" : "hard",
      },
    };
    updateRulesMutation.mutate(updated);
  };

  const handleUpdateAiWeight = (key: keyof AiWeights, value: number) => {
    const updated = { ...effectiveSettings.aiWeights, [key]: value };
    updateAiWeightsMutation.mutate(updated);
  };

  const handleTogglePublishBehavior = (key: keyof PublishBehavior, value: boolean | number) => {
    const updated = { ...effectiveSettings.publishBehavior, [key]: value };
    updatePublishBehaviorMutation.mutate(updated);
  };

  const handleAddTemplate = (template: Omit<RotationTemplate, "id">) => {
    const newTemplate: RotationTemplate = {
      ...template,
      id: crypto.randomUUID(),
    };
    updateRotationTemplatesMutation.mutate([...effectiveSettings.rotationTemplates, newTemplate]);
  };

  const handleUpdateTemplate = (id: string, updates: Partial<RotationTemplate>) => {
    const updated = effectiveSettings.rotationTemplates.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    updateRotationTemplatesMutation.mutate(updated);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = effectiveSettings.rotationTemplates.filter((t) => t.id !== id);
    updateRotationTemplatesMutation.mutate(updated);
  };

  const handleSetDefaultTemplate = (id: string) => {
    const updated = effectiveSettings.rotationTemplates.map((t) => ({
      ...t,
      isDefault: t.id === id,
    }));
    updateRotationTemplatesMutation.mutate(updated);
  };

  return {
    settings: effectiveSettings,
    isLoadingSettings,
    aiWeightsOpen,
    setAiWeightsOpen,
    editingTemplate,
    setEditingTemplate,
    handleToggleNotification,
    handleUpdateThreshold,
    handleToggleEnforcement,
    handleUpdateAiWeight,
    handleTogglePublishBehavior,
    handleAddTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleSetDefaultTemplate,
    updateNotificationsMutation,
    updateRulesMutation,
    updateAiWeightsMutation,
    updatePublishBehaviorMutation,
    updateRotationTemplatesMutation,
  };
}
