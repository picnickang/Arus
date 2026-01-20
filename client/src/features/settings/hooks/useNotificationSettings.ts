import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NotificationSetting } from "@shared/schema";

interface EmailStatus { enabled: boolean; provider: string; }
interface NotificationFormData { notificationType: string; vesselId: string | null; enabled: boolean; minSeverity: string; recipientEmails: string[]; deliveryMethod: string; digestMode: boolean; }

const initialFormData: NotificationFormData = { notificationType: "compliance", vesselId: null, enabled: true, minSeverity: "warning", recipientEmails: [], deliveryMethod: "email", digestMode: false };

export function useNotificationSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<NotificationSetting | null>(null);
  const [formData, setFormData] = useState<NotificationFormData>(initialFormData);
  const [emailInput, setEmailInput] = useState("");

  const { data: emailStatus } = useQuery<EmailStatus>({ queryKey: ["/api/notifications/email/status"] });
  const { data: settings = [], isLoading: settingsLoading } = useQuery<NotificationSetting[]>({ queryKey: ["/api/notifications/settings"] });
  const { data: vessels = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/vessels"] });

  const createMutation = useMutation({ mutationFn: async (data: Partial<NotificationSetting>) => apiRequest("/api/notifications/settings", { method: "POST", body: JSON.stringify(data) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] }); toast({ title: "Notification setting created" }); setIsDialogOpen(false); resetForm(); }, onError: () => { toast({ title: "Failed to create notification setting", variant: "destructive" }); } });
  const updateMutation = useMutation({ mutationFn: async ({ id, data }: { id: string; data: Partial<NotificationSetting> }) => apiRequest(`/api/notifications/settings/${id}`, { method: "PATCH", body: JSON.stringify(data) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] }); toast({ title: "Notification setting updated" }); setIsDialogOpen(false); resetForm(); }, onError: () => { toast({ title: "Failed to update notification setting", variant: "destructive" }); } });
  const deleteMutation = useMutation({ mutationFn: async (id: string) => apiRequest(`/api/notifications/settings/${id}`, { method: "DELETE" }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] }); toast({ title: "Notification setting deleted" }); }, onError: () => { toast({ title: "Failed to delete notification setting", variant: "destructive" }); } });
  const testMutation = useMutation({ mutationFn: async (email: string) => apiRequest("/api/notifications/email/test", { method: "POST", body: JSON.stringify({ email, subject: "ARUS Marine Test", message: "This is a test notification." }) }), onSuccess: (data: { message: string }) => { toast({ title: data.message || "Test notification sent" }); }, onError: () => { toast({ title: "Failed to send test notification", variant: "destructive" }); } });

  const resetForm = useCallback(() => { setFormData(initialFormData); setEmailInput(""); setEditingSetting(null); }, []);
  const openCreateDialog = useCallback(() => { resetForm(); setIsDialogOpen(true); }, [resetForm]);
  const openEditDialog = useCallback((setting: NotificationSetting) => { setEditingSetting(setting); setFormData({ notificationType: setting.notificationType, vesselId: setting.vesselId, enabled: setting.enabled ?? true, minSeverity: setting.minSeverity || "warning", recipientEmails: (setting.recipientEmails as string[]) ?? [], deliveryMethod: setting.deliveryMethod || "email", digestMode: setting.digestMode ?? false }); setIsDialogOpen(true); }, []);
  const handleAddEmail = useCallback(() => { if (emailInput?.includes("@")) { setFormData((prev) => ({ ...prev, recipientEmails: [...prev.recipientEmails, emailInput] })); setEmailInput(""); } }, [emailInput]);
  const handleRemoveEmail = useCallback((email: string) => { setFormData((prev) => ({ ...prev, recipientEmails: prev.recipientEmails.filter((e) => e !== email) })); }, []);
  const handleSubmit = useCallback(() => { const payload = { ...formData, recipientEmails: formData.recipientEmails }; if (editingSetting) {updateMutation.mutate({ id: editingSetting.id, data: payload });} else {createMutation.mutate(payload);} }, [formData, editingSetting, createMutation, updateMutation]);
  const handleDelete = useCallback((id: string) => { if (confirm("Delete this notification rule?")) {deleteMutation.mutate(id);} }, [deleteMutation]);
  const handleTestEmail = useCallback(() => { const email = prompt("Enter email for test notification:"); if (email) {testMutation.mutate(email);} }, [testMutation]);
  const getVesselName = useCallback((vesselId: string | null) => { if (!vesselId) {return "All Vessels";} const vessel = vessels.find((v) => v.id === vesselId); return vessel?.name || vesselId; }, [vessels]);
  const goBack = useCallback(() => setLocation("/settings"), [setLocation]);

  return { emailStatus, settings, settingsLoading, vessels, isDialogOpen, setIsDialogOpen, editingSetting, formData, setFormData, emailInput, setEmailInput, openCreateDialog, openEditDialog, handleAddEmail, handleRemoveEmail, handleSubmit, handleDelete, handleTestEmail, getVesselName, goBack, createMutation, updateMutation, testMutation };
}

export type { NotificationFormData };
