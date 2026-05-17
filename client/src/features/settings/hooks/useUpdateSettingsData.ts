import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { adminApiRequest, adminQueryFn } from "@/lib/admin-api";
import { queryClient } from "@/lib/queryClient";
import type { UpdateSettings, FleetUpdateStatus } from "@shared/schema";
import {
  updateSettingsSchema,
  type UpdateSettingsForm,
  type DeviceHistoryEntry,
} from "../lib/updateSettingsUtils";

interface GitHubStatus {
  connected: boolean;
  user: { login: string; name: string | null; avatar_url: string } | null;
  message: string;
}
interface GitHubRelease {
  id: number;
  tagName: string;
  name: string;
  body: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
}

export function useUpdateSettingsData() {
  const { toast } = useToast();
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<UpdateSettings>({
    queryKey: ["/api/admin/update-settings"],
    queryFn: adminQueryFn(["/api/admin/update-settings"]),
  });
  const { data: fleetStatus, isLoading: fleetLoading } = useQuery<FleetUpdateStatus[]>({
    queryKey: ["/api/admin/fleet-update-status"],
    queryFn: adminQueryFn(["/api/admin/fleet-update-status"]),
  });
  const { data: githubStatus, isLoading: githubStatusLoading } = useQuery<GitHubStatus>({
    queryKey: ["/api/admin/github/status"],
    queryFn: adminQueryFn(["/api/admin/github/status"]),
  });

  const form = useForm<UpdateSettingsForm>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      autoUpdateEnabled: false,
      autoUpdateCriticalOnly: true,
      updateChannel: "stable",
      checkInterval: 21600,
      deferUpdatesUntilPort: false,
      requireManualApproval: false,
      notifyOnUpdateAvailable: true,
      notifyOnUpdateApplied: true,
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: UpdateSettingsForm) =>
      adminApiRequest("PUT", "/api/admin/update-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/update-settings"] });
      toast({
        title: "Settings Saved",
        description: "Update settings have been saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Save",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const saveGitHubConfig = async (owner: string, repo: string, token?: string) => {
    await adminApiRequest("PUT", "/api/admin/update-settings", {
      ...form.getValues(),
      githubOwner: owner,
      githubRepo: repo,
      githubToken: token,
      githubConfigured: true,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/update-settings"] });
  };
  const onSubmit = (data: UpdateSettingsForm) => {
    updateSettingsMutation.mutate(data);
  };

  const checkIntervalOptions = [
    { value: 3600, label: "Every hour" },
    { value: 21600, label: "Every 6 hours" },
    { value: 43200, label: "Every 12 hours" },
    { value: 86400, label: "Every 24 hours" },
    { value: 604800, label: "Weekly" },
  ];

  return {
    settings,
    settingsLoading,
    fleetStatus,
    fleetLoading,
    githubStatus,
    githubStatusLoading,
    form,
    updateSettingsMutation,
    saveGitHubConfig,
    onSubmit,
    checkIntervalOptions,
    showGitHubDialog,
    setShowGitHubDialog,
  };
}

export function useDeviceHistoryData(deviceId: string, open: boolean) {
  const { toast } = useToast();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const { data: historyData, isLoading } = useQuery<{
    deviceId: string;
    deviceType: string;
    currentVersion: string;
    updateHistory: DeviceHistoryEntry[];
  }>({
    queryKey: ["/api/admin/fleet-update-status", deviceId, "history"],
    queryFn: adminQueryFn([`/api/admin/fleet-update-status/${deviceId}/history`]),
    enabled: open,
  });

  const rollbackMutation = useMutation({
    mutationFn: (targetVersion: string) =>
      adminApiRequest("POST", `/api/admin/fleet-update-status/${deviceId}/rollback`, {
        targetVersion,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fleet-update-status"] });
      toast({
        title: "Rollback Initiated",
        description: "Device will roll back to the selected version on next check-in",
      });
    },
    onError: (error) => {
      toast({
        title: "Rollback Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleRollback = () => {
    if (selectedVersion) {
      rollbackMutation.mutate(selectedVersion);
    }
  };

  return {
    historyData,
    isLoading,
    selectedVersion,
    setSelectedVersion,
    rollbackMutation,
    handleRollback,
  };
}

export function useGitHubReleasesData(channel: string) {
  const [expandedRelease, setExpandedRelease] = useState<number | null>(null);
  const {
    data: releases,
    isLoading,
    error,
  } = useQuery<GitHubRelease[]>({
    queryKey: ["/api/admin/github-releases", channel],
    // @ts-ignore -- bulk-silence
    queryFn: adminQueryFn(["/api/admin/github-releases", { channel }]),
  });
  return { releases, isLoading, error, expandedRelease, setExpandedRelease };
}

export function useGitHubConfigData(
  currentOwner: string | undefined,
  currentRepo: string | undefined,
  onSave: (owner: string, repo: string, token?: string) => Promise<void>,
  onOpenChange: (open: boolean) => void
) {
  const { toast } = useToast();
  const [owner, setOwner] = useState(currentOwner || "");
  const [repo, setRepo] = useState(currentRepo || "");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!owner.trim() || !repo.trim()) {
      toast({
        title: "Validation Error",
        description: "GitHub owner and repository name are required",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      await onSave(owner, repo, token || undefined);
      onOpenChange(false);
      toast({
        title: "GitHub Configuration Saved",
        description: "Your GitHub repository has been configured for updates",
      });
    } catch (error) {
      toast({
        title: "Failed to Save",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    owner,
    setOwner,
    repo,
    setRepo,
    token,
    setToken,
    showToken,
    setShowToken,
    isSaving,
    handleSave,
  };
}
