import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useCreateMutation, useUpdateMutation, useDeleteMutation, useCustomMutation } from "@/hooks/useCrudMutations";
import { useAlertConfigurations, useAlertNotifications } from "@/features/alerts";
import { useEquipmentList, useEquipmentHealth } from "@/features/vessels";
import type { AlertConfiguration, AlertNotification } from "@shared/schema";

const alertConfigSchema = z.object({ equipmentId: z.string().min(1, "Equipment ID is required"), sensorType: z.string().min(1, "Sensor type is required"), warningThreshold: z.number().min(0, "Warning threshold must be positive").optional(), criticalThreshold: z.number().min(0, "Critical threshold must be positive").optional(), enabled: z.boolean(), notifyEmail: z.boolean(), notifyInApp: z.boolean() });
export type AlertConfigFormData = z.infer<typeof alertConfigSchema>;

export function useAlertsData() {
  const { toast } = useToast();
  const { isConnected, latestAlert, lastMessage, subscribe, unsubscribe } = useWebSocket({ autoConnect: true });
  const [selectedTab, setSelectedTab] = useState<"configurations" | "notifications">("configurations");
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AlertConfiguration | null>(null);
  const isSubscribedRef = useRef(false);

  const { data: configurations = [], isLoading: configLoading } = useAlertConfigurations();
  const { data: notifications = [], isLoading: notificationLoading } = useAlertNotifications();
  const { data: equipmentRegistry = [] } = useEquipmentList();
  const { data: equipmentHealth = [] } = useEquipmentHealth();

  const getEquipmentName = useCallback((equipmentId: string | null | undefined): string => { if (!equipmentId) {return "Unknown";} const healthItem = equipmentHealth?.find((eq) => eq.id === equipmentId); if (healthItem?.name) {return healthItem.name;} const equipment = equipmentRegistry?.find((eq) => eq.id === equipmentId); if (equipment?.name) {return equipment.name;} return equipmentId; }, [equipmentHealth, equipmentRegistry]);
  const getEquipmentType = useCallback((equipmentId: string | null | undefined): string => { if (!equipmentId) {return "unknown";} const equipment = equipmentRegistry?.find((eq) => eq.id === equipmentId); if (equipment?.type) {return equipment.type;} const healthItem = equipmentHealth?.find((eq) => eq.id === equipmentId); if (healthItem?.type) {return healthItem.type;} return "unknown"; }, [equipmentRegistry, equipmentHealth]);

  const form = useForm<AlertConfigFormData>({ resolver: zodResolver(alertConfigSchema), defaultValues: { equipmentId: "", sensorType: "", warningThreshold: 0, criticalThreshold: 0, enabled: true, notifyEmail: false, notifyInApp: true } });

  const createConfigMutation = useCreateMutation<AlertConfigFormData>("/api/alerts/configurations", { successMessage: "Alert configuration created", successDescription: "The alert configuration has been created successfully.", onSuccess: () => { setIsConfigDialogOpen(false); form.reset(); } });
  const updateConfigMutation = useUpdateMutation<Partial<AlertConfigFormData>>("/api/alerts/configurations", { successMessage: "Alert configuration updated", successDescription: "The alert configuration has been updated successfully.", onSuccess: () => { setEditingConfig(null); setIsConfigDialogOpen(false); form.reset(); } });
  const deleteConfigMutation = useDeleteMutation("/api/alerts/configurations", {});
  const acknowledgeAlertMutation = useCustomMutation({ mutationFn: async ({ id, acknowledgedBy }: { id: string; acknowledgedBy: string }) => { const response = await apiRequest("PATCH", `/api/alerts/notifications/${id}/acknowledge`, { acknowledgedBy }); return response.json(); }, invalidateKeys: ["/api/alerts/notifications"] });
  const clearAllAlertsMutation = useCustomMutation({ mutationFn: async () => { const response = await apiRequest("DELETE", "/api/alerts/all"); return response.json(); }, invalidateKeys: ["/api/alerts/notifications"], successMessage: "All alerts cleared", successDescription: "All alert notifications have been successfully cleared." });

  const handleSubmit = useCallback((data: AlertConfigFormData) => { if (editingConfig) { updateConfigMutation.mutate({ id: editingConfig.id, data }); } else { createConfigMutation.mutate(data); } }, [editingConfig, updateConfigMutation, createConfigMutation]);
  const handleEdit = useCallback((config: AlertConfiguration) => { setEditingConfig(config); form.reset({ equipmentId: config.equipmentId, sensorType: config.sensorType, warningThreshold: config.warningThreshold || 0, criticalThreshold: config.criticalThreshold || 0, enabled: config.enabled || false, notifyEmail: config.notifyEmail || false, notifyInApp: config.notifyInApp || true }); setIsConfigDialogOpen(true); }, [form]);
  const handleDelete = useCallback((id: string) => { if (confirm("Are you sure you want to delete this alert configuration?")) { deleteConfigMutation.mutate(id); } }, [deleteConfigMutation]);
  const handleAcknowledge = useCallback((notification: AlertNotification) => { acknowledgeAlertMutation.mutate({ id: notification.id, acknowledgedBy: "Current User" }); }, [acknowledgeAlertMutation]);
  const handleClearAllAlerts = useCallback(() => { if (confirm("Are you sure you want to clear all alert notifications? This action cannot be undone.")) { clearAllAlertsMutation.mutate(); } }, [clearAllAlertsMutation]);

  useEffect(() => { if (isConnected && !isSubscribedRef.current) { subscribe("alerts"); isSubscribedRef.current = true; } return () => { if (isSubscribedRef.current) { unsubscribe("alerts"); isSubscribedRef.current = false; } }; }, [isConnected, subscribe, unsubscribe]);

  useEffect(() => { if (latestAlert) { queryClient.setQueryData<AlertNotification[]>(["/api/alerts/notifications"], (oldData) => { if (!oldData) {return [latestAlert];} const exists = oldData.some((alert) => alert.id === latestAlert.id); if (exists) {return oldData;} return [latestAlert, ...oldData]; }); if (!latestAlert.acknowledged) { toast({ title: `${latestAlert.alertType.toUpperCase()} Alert`, description: `${getEquipmentName(latestAlert.equipmentId)}: ${latestAlert.message}`, variant: latestAlert.alertType === "critical" ? "destructive" : "default" }); } } }, [latestAlert, toast, getEquipmentName]);

  useEffect(() => { if (lastMessage?.type === "alert_acknowledged") { const { alertId, acknowledgedBy } = lastMessage.data; queryClient.setQueryData<AlertNotification[]>(["/api/alerts/notifications"], (oldData) => { if (!oldData) {return oldData;} return oldData.map((alert) => alert.id === alertId ? { ...alert, acknowledged: true, acknowledgedBy, acknowledgedAt: lastMessage.timestamp } : alert); }); } }, [lastMessage]);

  const getSeverityColor = useCallback((alertType: string) => { switch (alertType) { case "critical": return "bg-red-500"; case "warning": return "bg-yellow-500"; default: return "bg-blue-500"; } }, []);

  return {
    selectedTab, setSelectedTab, isConfigDialogOpen, setIsConfigDialogOpen, editingConfig, setEditingConfig,
    configurations, configLoading, notifications, notificationLoading, equipmentRegistry,
    form, createConfigMutation, updateConfigMutation, acknowledgeAlertMutation, clearAllAlertsMutation,
    handleSubmit, handleEdit, handleDelete, handleAcknowledge, handleClearAllAlerts,
    getEquipmentName, getEquipmentType, getSeverityColor,
  };
}
