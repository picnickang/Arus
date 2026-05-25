import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import { adminApiRequest, adminQueryFn } from "@/lib/admin-api";
import type { AdminSystemSetting } from "@shared/schema";

const systemSettingSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required"),
  category: z.string().min(1, "Category is required"),
  key: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Value is required"),
  dataType: z.enum(["string", "number", "boolean", "object", "array"]),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
});

export type SystemSettingForm = z.infer<typeof systemSettingSchema>;

export const systemSettingsKeys = {
  all: ["/api/admin/settings"] as const,
};

export function useSystemSettingsTabData() {
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminSystemSetting | null>(null);

  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: systemSettingsKeys.all,
    queryFn: adminQueryFn(systemSettingsKeys.all as object as Parameters<typeof adminQueryFn>[0]),
  });

  const form = useForm<SystemSettingForm, unknown, SystemSettingForm>({
    resolver: zodResolver(systemSettingSchema),
    defaultValues: {
      orgId: "default-org-id",
      category: "",
      key: "",
      value: "",
      description: "",
      isPublic: false,
    },
  });

  const createMutation = useCustomMutation<SystemSettingForm, AdminSystemSetting>({
    mutationFn: (data) => adminApiRequest("POST", "/api/admin/settings", data),
    invalidateKeys: [systemSettingsKeys.all],
    successMessage: "System setting created successfully",
    onSuccess: () => {
      setCreateDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useCustomMutation<
    { id: string; data: Partial<SystemSettingForm> },
    AdminSystemSetting
  >({
    mutationFn: ({ id, data }) => adminApiRequest("PUT", `/api/admin/settings/${id}`, data),
    invalidateKeys: [systemSettingsKeys.all],
    successMessage: "System setting updated successfully",
    onSuccess: () => setEditingItem(null),
  });

  const deleteMutation = useCustomMutation<string, void>({
    mutationFn: (id) => adminApiRequest("DELETE", `/api/admin/settings/${id}`),
    invalidateKeys: [systemSettingsKeys.all],
    successMessage: "System setting deleted successfully",
  });

  const handleSubmit = useCallback(
    (data: SystemSettingForm) => {
      if (editingItem) {
        updateMutation.mutate({ id: editingItem.id, data });
      } else {
        createMutation.mutate(data);
      }
    },
    [editingItem, createMutation, updateMutation]
  );

  const handleEdit = useCallback(
    (setting: AdminSystemSetting) => {
      setEditingItem(setting);
      form.reset({
        orgId: setting.orgId,
        category: setting.category,
        key: setting.key,
        value: JSON.stringify(setting.value),
        description: setting.description || "",
        isPublic: !setting.isSecret,
      });
      setCreateDialogOpen(true);
    },
    [form]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const handleCloseDialog = useCallback(() => {
    setCreateDialogOpen(false);
    setEditingItem(null);
    form.reset();
  }, [form]);

  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    form.reset({
      orgId: "default-org-id",
      category: "",
      key: "",
      value: "",
      description: "",
      isPublic: false,
    });
    setCreateDialogOpen(true);
  }, [form]);

  const navigateToEmailSettings = useCallback(() => {
    setLocation("/email-alerts-settings");
  }, [setLocation]);

  const navigateToNotificationSettings = useCallback(() => {
    setLocation("/notification-settings");
  }, [setLocation]);

  const settingsList = useMemo(() => (settings ?? []) as AdminSystemSetting[], [settings]);

  return {
    settings: settingsList,
    isLoading,
    error,
    form,
    createDialogOpen,
    setCreateDialogOpen,
    editingItem,
    createMutation,
    updateMutation,
    deleteMutation,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleCloseDialog,
    handleOpenCreate,
    navigateToEmailSettings,
    navigateToNotificationSettings,
  };
}
