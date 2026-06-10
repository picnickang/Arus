import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { Vessel } from "@shared/schema";

const settingsFormSchema = z.object({
  vesselId: z.string().optional(),
  enabled: z.boolean().default(true),
  integrationMode: z.enum(["file", "api", "sftp"]).default("file"),
  autoFillEnabled: z.boolean().default(true),
  overwriteManualEntries: z.boolean().default(false),
  confidenceThreshold: z.number().min(0).max(1).default(0.8),
  pollIntervalMinutes: z.number().min(5).max(1440).optional(),
  apiUrl: z.string().optional(),
  apiKey: z.string().optional(),
  sftpHost: z.string().optional(),
  sftpPort: z.number().optional(),
  sftpUser: z.string().optional(),
  sftpPassword: z.string().optional(),
  sftpPath: z.string().optional(),
  notes: z.string().optional(),
});
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export interface ImportHistory {
  id: string;
  createdAt: string;
  vesselId: string;
  fileName?: string;
  recordsCreated?: number;
  recordsFailed?: number;
  status: string;
  durationMs?: number;
}

export function useStormGeoSettingsData(vesselId?: string) {
  const { orgId } = useOrganization() as object as { orgId: string };
  const { toast } = useToast();
  const _queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedVesselForUpload, setSelectedVesselForUpload] = useState<string>("");

  const { data: vessels, isLoading: loadingVessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });
  const {
    data: settings,
    isLoading: loadingSettings,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["/api/stormgeo/settings", vesselId],
    queryFn: async () => {
      const params = vesselId ? `?vesselId=${vesselId}` : "";
      return apiRequest(`/api/stormgeo/settings${params}`);
    },
  });
  const {
    data: importHistory,
    isLoading: loadingHistory,
    refetch: refetchHistory,
  } = useQuery<ImportHistory[]>({
    queryKey: ["/api/stormgeo/import-history", vesselId],
    queryFn: async () => {
      const params = vesselId ? `?vesselId=${vesselId}&limit=10` : "?limit=10";
      return apiRequest(`/api/stormgeo/import-history${params}`);
    },
  });

  const form = useForm<SettingsFormValues, unknown, SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      vesselId: vesselId || "__all__",
      enabled: true,
      integrationMode: "file",
      autoFillEnabled: true,
      overwriteManualEntries: false,
      confidenceThreshold: 0.8,
      pollIntervalMinutes: 60,
      apiUrl: "",
      apiKey: "",
      sftpHost: "",
      sftpPort: 22,
      sftpUser: "",
      sftpPassword: "",
      sftpPath: "",
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormValues) =>
      apiRequest("POST", "/api/stormgeo/settings", data),
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "StormGeo integration settings have been updated.",
      });
      refetchSettings();
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      console.error("Save settings error:", error);
    },
  });
  const importMutation = useMutation<{ status: string; recordsCreated: number; recordsFailed: number }, Error, { vesselId: string; fileContent: string; fileName: string }>({
    mutationFn: (async ({
      vesselId,
      fileContent,
      fileName,
    }: {
      vesselId: string;
      fileContent: string;
      fileName: string;
    }) =>
      apiRequest("POST", "/api/stormgeo/import", {
        vesselId,
        fileContent,
        fileName,
        fileType: fileName.endsWith(".json") ? "json" : "csv",
      })) as object as never,
    onSuccess: (data: { status: string; recordsCreated: number; recordsFailed: number }) => {
      toast({
        title: data.status === "success" ? "Import successful" : "Import completed with issues",
        description: `Created ${data.recordsCreated} records, ${data.recordsFailed} failed.`,
        variant: data.status === "success" ? "default" : "destructive",
      });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedVesselForUpload("");
      refetchHistory();
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: "Could not import the file.",
        variant: "destructive",
      });
      console.error("Import error:", error);
    },
  });

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const validExtensions = [".csv", ".json"];
        const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!validExtensions.includes(extension)) {
          toast({
            title: "Invalid file type",
            description: "Please upload a CSV or JSON file.",
            variant: "destructive",
          });
          return;
        }
        setSelectedFile(file);
      }
    },
    [toast]
  );

  const handleImport = useCallback(async () => {
    if (!selectedFile || !selectedVesselForUpload) {
      toast({
        title: "Missing information",
        description: "Please select a vessel and a file to import.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      importMutation.mutate({
        vesselId: selectedVesselForUpload,
        fileContent: content,
        fileName: selectedFile.name,
      });
    };
    reader.readAsText(selectedFile);
  }, [selectedFile, selectedVesselForUpload, importMutation, toast]);

  const onSubmitSettings = useCallback(
    (data: SettingsFormValues) => {
      const submitData = { ...data, vesselId: data.vesselId === "__all__" ? "" : data.vesselId };
      saveSettingsMutation.mutate(submitData);
    },
    [saveSettingsMutation]
  );

  const handleCancelUpload = useCallback(() => {
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setSelectedVesselForUpload("");
  }, []);

  const getVesselName = useCallback(
    (vId: string) => {
      const vessel = vessels?.find((v) => v.id === vId);
      return vessel?.name || "Unknown";
    },
    [vessels]
  );

  return {
    vessels,
    loadingVessels,
    settings,
    loadingSettings,
    importHistory,
    loadingHistory,
    uploadDialogOpen,
    setUploadDialogOpen,
    selectedFile,
    selectedVesselForUpload,
    setSelectedVesselForUpload,
    form,
    saveSettingsMutation,
    importMutation,
    handleFileChange,
    handleImport,
    onSubmitSettings,
    handleCancelUpload,
    refetchHistory,
    getVesselName,
  };
}
