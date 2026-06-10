import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import { useToast } from "@/hooks/use-toast";
import { adminApiRequest, adminQueryFn } from "@/lib/admin-api";
import { isDesktop } from "@/lib/desktop";
import { publishPatchSchema, changePasswordSchema } from "../lib/adminSchemas";
import type { PublishPatchForm, ChangePasswordForm } from "../lib/adminSchemas";
import type { SoftwarePatch, UpdateSettings } from "@shared/schema";

export const adminKeys = {
  patches: ["/api/admin/patches"] as const,
  patchHistory: ["/api/admin/patches", "history"] as const,
  updateSettings: ["/api/admin/update-settings"] as const,
  githubStatus: ["/api/admin/github/status"] as const,
  githubRepos: ["/api/admin/github/repos"] as const,
};

export function useSystemAdminData() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("configuration");
  const isDesktopEnv = isDesktop();

  return { toast, activeTab, setActiveTab, isDesktopEnv };
}

export function useSoftwareUpdatesData() {
  const { toast } = useToast();
  const [selectedPatch, setSelectedPatch] = useState<SoftwarePatch | null>(null);
  const isDesktopEnv = isDesktop();

  const {
    data: patches,
    isLoading: patchesLoading,
    isError: patchesError,
    error: patchesErrorData,
  } = useQuery({
    queryKey: adminKeys.patches,
    queryFn: adminQueryFn(adminKeys.patches),
    enabled: !isDesktopEnv,
  });
  const {
    data: patchHistory,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErrorData,
  } = useQuery({
    queryKey: adminKeys.patchHistory,
    queryFn: adminQueryFn(["/api/admin/patches/history"]),
    enabled: !isDesktopEnv,
  });
  const {
    data: updateSettings,
    isLoading: settingsLoading,
    isError: settingsError,
    error: settingsErrorData,
  } = useQuery<UpdateSettings>({
    queryKey: adminKeys.updateSettings,
    queryFn: adminQueryFn(adminKeys.updateSettings),
    enabled: !isDesktopEnv,
  });

  const checkUpdatesMutation = useCustomMutation<void, void>({
    mutationFn: () => adminApiRequest("POST", "/api/admin/updates/check"),
    invalidateKeys: [adminKeys.patches],
    successMessage: "Checking for updates...",
  });
  const downloadMutation = useCustomMutation<string, void>({
    mutationFn: (patchId) => adminApiRequest("POST", `/api/admin/patches/${patchId}/download`),
    invalidateKeys: [adminKeys.patches],
    successMessage: "Patch download started",
  });
  const applyMutation = useCustomMutation<{ id: string; patchPath: string }, void>({
    mutationFn: ({ id, patchPath }) =>
      adminApiRequest("POST", `/api/admin/patches/${id}/apply`, { patchPath }),
    invalidateKeys: [adminKeys.patches, adminKeys.patchHistory],
    successMessage: "Patch applied successfully",
  });
  const rollbackMutation = useCustomMutation<string, void>({
    mutationFn: (backupId) => adminApiRequest("POST", `/api/admin/patches/rollback/${backupId}`),
    invalidateKeys: [adminKeys.patches, adminKeys.patchHistory],
    successMessage: "Rolled back successfully",
  });
  const previewMutation = useCustomMutation<
    { fromVersion: string; toVersion: string },
    {
      filesChanged?: number;
      additions?: number;
      deletions?: number;
      commits?: Array<{ sha: string; message: string }>;
    }
  >({
    mutationFn: (data) => adminApiRequest("POST", "/api/admin/patches/preview", data),
    successMessage: "Preview generated successfully",
  });
  const publishMutation = useCustomMutation<PublishPatchForm, void>({
    mutationFn: (data) => adminApiRequest("POST", "/api/admin/patches/publish", data),
    invalidateKeys: [adminKeys.patches, adminKeys.patchHistory],
    successMessage: "Patch published successfully!",
  });

  const publishForm = useForm<PublishPatchForm, unknown, PublishPatchForm>({
    resolver: zodResolver(publishPatchSchema),
    defaultValues: {
      fromVersion: "",
      version: "",
      severity: "medium",
      releaseNotes: "",
      channel: "stable",
      requiresRestart: true,
      patchType: "incremental",
    },
  });
  const onPublishSubmit = async (data: PublishPatchForm) => {
    await publishMutation.mutateAsync(data);
    publishForm.reset();
  };

  const handlePreview = () => {
    const values = publishForm.getValues();
    if (values.fromVersion && values.version) {
      previewMutation.mutate({ fromVersion: values.fromVersion, toVersion: values.version });
    } else {
      toast({
        title: "Missing Versions",
        description: "Please enter both from and to versions to preview",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (s: string) =>
    ({ critical: "destructive", high: "secondary", medium: "default", low: "outline" })[s] ??
    "outline";
  const getStatusColor = (s: string) =>
    ({
      applied: "default",
      available: "secondary",
      downloading: "outline",
      failed: "destructive",
      rolled_back: "secondary",
    })[s] ?? "outline";

  const isLoading = patchesLoading || historyLoading || settingsLoading;
  const hasError = patchesError || historyError || settingsError;
  const errors = {
    patches: patchesError ? (patchesErrorData as Error | null)?.message : null,
    history: historyError ? (historyErrorData as Error | null)?.message : null,
    settings: settingsError ? (settingsErrorData as Error | null)?.message : null,
  };

  return {
    isDesktopEnv,
    isLoading,
    hasError,
    errors,
    patches: patches as SoftwarePatch[] | undefined,
    patchHistory: patchHistory as Array<SoftwarePatch & { backupId?: string }> | undefined,
    updateSettings,
    selectedPatch,
    setSelectedPatch,
    checkUpdatesMutation,
    downloadMutation,
    applyMutation,
    rollbackMutation,
    previewMutation,
    publishMutation,
    publishForm,
    onPublishSubmit,
    handlePreview,
    getSeverityColor,
    getStatusColor,
  };
}

export function useGitHubSettingsData() {
  const { data: githubStatus, isLoading: githubLoading } = useQuery<{
    connected: boolean;
    user?: { login: string; name?: string; avatar_url?: string };
    message?: string;
  }>({
    queryKey: adminKeys.githubStatus,
    queryFn: adminQueryFn(adminKeys.githubStatus),
  });
  const { data: reposData, isLoading: reposLoading } = useQuery<{
    repos: Array<{ id: number; name: string; full_name: string; owner: string; html_url: string }>;
  }>({
    queryKey: adminKeys.githubRepos,
    queryFn: adminQueryFn(adminKeys.githubRepos),
    enabled: githubStatus?.connected === true,
  });
  const { data: settings } = useQuery<UpdateSettings>({
    queryKey: adminKeys.updateSettings,
    queryFn: adminQueryFn(adminKeys.updateSettings),
  });

  const selectRepoMutation = useCustomMutation({
    mutationFn: async ({ owner, repo }: { owner: string; repo: string }) =>
      adminApiRequest("PUT", "/api/admin/update-settings", {
        githubOwner: owner,
        githubRepo: repo,
      }),
    invalidateKeys: [adminKeys.updateSettings],
    successMessage: "Repository configured successfully",
  });

  return { githubStatus, githubLoading, reposData, reposLoading, settings, selectRepoMutation };
}

export function useConfigurationTabData() {
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);

  const passwordForm = useForm<ChangePasswordForm, unknown, ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const changePasswordMutation = useCustomMutation({
    mutationFn: async (data: ChangePasswordForm) =>
      adminApiRequest("POST", "/api/admin/auth/change-password", data),
    successMessage: "Password updated successfully",
  });

  const handlePasswordSubmit = async (data: ChangePasswordForm) => {
    await changePasswordMutation.mutateAsync(data);
    passwordForm.reset();
    setPasswordSectionOpen(false);
  };
  const cancelPasswordChange = () => {
    passwordForm.reset();
    setPasswordSectionOpen(false);
  };

  return {
    showPassword,
    setShowPassword,
    passwordSectionOpen,
    setPasswordSectionOpen,
    passwordForm,
    changePasswordMutation,
    handlePasswordSubmit,
    cancelPasswordChange,
  };
}
