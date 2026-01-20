import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { createDefaultThresholdForm, createDefaultEmailSettings } from "../lib/alertUtils";
import type { EmailAlertSettings, EmailAlertThreshold, EmailLog, CrewAlertSettings } from "../types";

export const alertSettingsKeys = {
  settings: ["/api/alert-settings"] as const,
  thresholds: ["/api/alert-settings/thresholds"] as const,
  logs: ["/api/alert-settings/email-logs"] as const,
  crew: ["/api/alert-settings/crew"] as const,
  vessels: ["/api/vessels"] as const,
  crewMembers: ["/api/crew"] as const,
};

interface Vessel { id: string; name: string; }
interface CrewMember { id: string; name: string; rank: string; vesselId: string | null; }

export function useEmailAlertsData() {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [isThresholdDialogOpen, setIsThresholdDialogOpen] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<EmailAlertThreshold | null>(null);
  const [thresholdForm, setThresholdForm] = useState(createDefaultThresholdForm());
  const [formData, setFormData] = useState<Partial<EmailAlertSettings>>(createDefaultEmailSettings());
  const [apiKey, setApiKey] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");

  const { data: settings, isLoading: settingsLoading } = useQuery<EmailAlertSettings>({ queryKey: alertSettingsKeys.settings });
  const { data: thresholds = [], isLoading: thresholdsLoading } = useQuery<EmailAlertThreshold[]>({ queryKey: alertSettingsKeys.thresholds });
  const { data: emailLogs = [], isLoading: logsLoading } = useQuery<EmailLog[]>({ queryKey: alertSettingsKeys.logs });
  const { data: crewSettings = {}, isLoading: crewSettingsLoading } = useQuery<CrewAlertSettings>({ queryKey: alertSettingsKeys.crew });
  const { data: vessels = [] } = useQuery<Vessel[]>({ queryKey: alertSettingsKeys.vessels });
  const { data: crewMembers = [] } = useQuery<CrewMember[]>({ queryKey: alertSettingsKeys.crewMembers });

  useEffect(() => {
    if (settings) {
      setFormData({
        emailEnabled: settings.emailEnabled, defaultToEmail: settings.defaultToEmail, ccEmails: settings.ccEmails, bccEmails: settings.bccEmails,
        timezone: settings.timezone, provider: settings.provider, smtpHost: settings.smtpHost, smtpPort: settings.smtpPort, smtpUser: settings.smtpUser,
        smtpUseTls: settings.smtpUseTls, fromEmail: settings.fromEmail, fromName: settings.fromName, alertCooldownMinutes: settings.alertCooldownMinutes,
        dailyDigestEnabled: settings.dailyDigestEnabled, dailyDigestTime: settings.dailyDigestTime,
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<EmailAlertSettings> & { apiKey?: string; smtpPassword?: string }) => apiRequest("/api/alert-settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: alertSettingsKeys.settings }); toast({ title: "Settings saved successfully" }); setApiKey(""); setSmtpPassword(""); },
    onError: (error: Error) => { toast({ title: "Failed to save settings", description: error.message, variant: "destructive" }); },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => apiRequest("/api/alert-settings/send-test", { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: alertSettingsKeys.settings }); toast({ title: "Test email sent successfully" }); setIsTestDialogOpen(false); setTestEmail(""); },
    onError: (error: Error) => { toast({ title: "Failed to send test email", description: error.message, variant: "destructive" }); },
  });

  const createThresholdMutation = useMutation({
    mutationFn: async (data: typeof thresholdForm) => apiRequest("/api/alert-settings/thresholds", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: alertSettingsKeys.thresholds }); toast({ title: "Threshold created successfully" }); setIsThresholdDialogOpen(false); resetThresholdForm(); },
    onError: (error: Error) => { toast({ title: "Failed to create threshold", description: error.message, variant: "destructive" }); },
  });

  const updateThresholdMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: typeof thresholdForm }) => apiRequest(`/api/alert-settings/thresholds/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: alertSettingsKeys.thresholds }); toast({ title: "Threshold updated successfully" }); setIsThresholdDialogOpen(false); resetThresholdForm(); },
    onError: (error: Error) => { toast({ title: "Failed to update threshold", description: error.message, variant: "destructive" }); },
  });

  const deleteThresholdMutation = useMutation({
    mutationFn: async (key: string) => apiRequest(`/api/alert-settings/thresholds/${encodeURIComponent(key)}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: alertSettingsKeys.thresholds }); toast({ title: "Threshold deleted successfully" }); },
    onError: (error: Error) => { toast({ title: "Failed to delete threshold", description: error.message, variant: "destructive" }); },
  });

  const updateCrewSettingsMutation = useMutation({
    mutationFn: async (data: { crewMemberId: string; settings: CrewAlertSettings[string] }) => apiRequest(`/api/alert-settings/crew/${data.crewMemberId}`, { method: "PUT", body: JSON.stringify(data.settings) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: alertSettingsKeys.crew }); toast({ title: "Crew alert settings updated" }); },
    onError: (error: Error) => { toast({ title: "Failed to update crew settings", description: error.message, variant: "destructive" }); },
  });

  const resetThresholdForm = () => { setEditingThreshold(null); setThresholdForm(createDefaultThresholdForm()); };

  const handleSaveSettings = () => {
    const payload: Partial<EmailAlertSettings> & { apiKey?: string; smtpPassword?: string } = { ...formData };
    if (apiKey) {payload.apiKey = apiKey;}
    if (smtpPassword) {payload.smtpPassword = smtpPassword;}
    updateSettingsMutation.mutate(payload);
  };

  const handleEditThreshold = (threshold: EmailAlertThreshold) => {
    setEditingThreshold(threshold);
    setThresholdForm({ key: threshold.key, name: threshold.name, category: threshold.category, severity: threshold.severity, thresholdValue: threshold.thresholdValue, thresholdUnit: threshold.thresholdUnit, enabled: threshold.enabled, sendEmail: threshold.sendEmail, description: threshold.description, cooldownMinutes: threshold.cooldownMinutes });
    setIsThresholdDialogOpen(true);
  };

  const handleSaveThreshold = () => { if (editingThreshold) {updateThresholdMutation.mutate({ key: editingThreshold.key, data: thresholdForm });} else {createThresholdMutation.mutate(thresholdForm);} };

  const getCrewMemberSettings = (crewId: string) => crewSettings[crewId] || { certificateExpiry: true, hoursOfRestViolation: true, missingSignature: false, minimumManning: true, crewChange: true, customEmail: null };
  const getCrewVessel = (vesselId: string | null) => vesselId ? vessels.find((v) => v.id === vesselId) : null;

  const updateCrewSetting = (crewId: string, key: string, value: boolean) => {
    const current = getCrewMemberSettings(crewId);
    updateCrewSettingsMutation.mutate({ crewMemberId: crewId, settings: { ...current, [key]: value } });
  };

  return {
    settings, settingsLoading, thresholds, thresholdsLoading, emailLogs, logsLoading, crewSettingsLoading, vessels, crewMembers,
    showApiKey, setShowApiKey, showSmtpPassword, setShowSmtpPassword, testEmail, setTestEmail, isTestDialogOpen, setIsTestDialogOpen,
    isThresholdDialogOpen, setIsThresholdDialogOpen, editingThreshold, thresholdForm, setThresholdForm, formData, setFormData, apiKey, setApiKey, smtpPassword, setSmtpPassword,
    updateSettingsMutation, testEmailMutation, createThresholdMutation, updateThresholdMutation, deleteThresholdMutation, updateCrewSettingsMutation,
    resetThresholdForm, handleSaveSettings, handleEditThreshold, handleSaveThreshold, getCrewMemberSettings, getCrewVessel, updateCrewSetting,
  };
}

export type EmailAlertsHookReturn = ReturnType<typeof useEmailAlertsData>;
