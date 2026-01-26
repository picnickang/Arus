import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface ScheduledReportsSettings {
  reportRetentionDays: number;
  defaultTimezone: string;
  maxRecipientsPerSchedule: number;
  reportGenerationTimeoutSeconds: number;
}

export const DEFAULT_SCHEDULED_REPORTS_SETTINGS: ScheduledReportsSettings = {
  reportRetentionDays: 7,
  defaultTimezone: "UTC",
  maxRecipientsPerSchedule: 10,
  reportGenerationTimeoutSeconds: 120,
};

export function useScheduledReportsSettingsData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settingsResponse, isLoading: isLoadingSettings } = useQuery<{ data: ScheduledReportsSettings }>({
    queryKey: ["/api/scheduled-reports/settings"],
  });

  const settings: ScheduledReportsSettings = settingsResponse?.data || DEFAULT_SCHEDULED_REPORTS_SETTINGS;

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<ScheduledReportsSettings>) => {
      return apiRequest("PATCH", "/api/scheduled-reports/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports/settings"] });
      toast({ title: "Settings Updated", description: "Scheduled reports settings have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
    },
  });

  const handleUpdateRetentionDays = (value: number) => {
    updateSettingsMutation.mutate({ reportRetentionDays: value });
  };

  const handleUpdateDefaultTimezone = (value: string) => {
    updateSettingsMutation.mutate({ defaultTimezone: value });
  };

  const handleUpdateMaxRecipients = (value: number) => {
    updateSettingsMutation.mutate({ maxRecipientsPerSchedule: value });
  };

  const handleUpdateTimeout = (value: number) => {
    updateSettingsMutation.mutate({ reportGenerationTimeoutSeconds: value });
  };

  return {
    settings,
    isLoadingSettings,
    updateSettingsMutation,
    handleUpdateRetentionDays,
    handleUpdateDefaultTimezone,
    handleUpdateMaxRecipients,
    handleUpdateTimeout,
  };
}
