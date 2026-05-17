import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCustomMutation } from "@/hooks/useCrudMutations";

type ImportResult = {
  ok: boolean;
  inserted: number;
  processed?: number;
  message: string;
  errors?: Array<{ message: string; line?: number }>;
};
type RawTelemetry = {
  id: string;
  vessel: string;
  ts: Date;
  src: string;
  sig: string;
  value: number | null;
  unit: string | null;
  createdAt: Date;
};

async function fetchRawTelemetry(): Promise<RawTelemetry[]> {
  const response = await fetch("/api/raw-telemetry");
  if (!response.ok) {
    throw new Error("Failed to fetch raw telemetry data");
  }
  return response.json();
}

export function useManualTelemetryUpload() {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState("");
  const [jsonData, setJsonData] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const {
    data: telemetryData,
    isLoading: dataLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/raw-telemetry"],
    queryFn: fetchRawTelemetry,
    refetchInterval: 60000,
  });

  const csvImportMutation = useCustomMutation<string, ImportResult>({
    mutationFn: (async (csvData: string) => {
      setUploadProgress(50);
      return apiRequest("POST", "/api/import/telemetry/csv", { csvData });
    }) as any,
    invalidateKeys: [["/api/raw-telemetry"]],
    successMessage: (result: ImportResult) => result.message,
    errorMessage: (error: unknown) => (error as Error)?.message || "Failed to import CSV data",
    onSuccess: (result: ImportResult) => {
      setUploadProgress(100);
      setLastResult(result);
      setTimeout(() => setUploadProgress(0), 2000);
    },
    onError: (error: unknown) => {
      const err = error as Error & { errors?: Array<{ message: string }> };
      setUploadProgress(0);
      setLastResult({
        ok: false,
        inserted: 0,
        message: err?.message || "CSV import failed",
        errors: err?.errors,
      });
    },
  });
  const jsonImportMutation = useCustomMutation({
    mutationFn: (async (jsonData: string) => {
      setUploadProgress(50);
      const parsed = JSON.parse(jsonData);
      return apiRequest("POST", "/api/import/telemetry/json", parsed);
    }) as any,
    invalidateKeys: [["/api/raw-telemetry"]],
    successMessage: (result: ImportResult) => result.message,
    errorMessage: (error: unknown) => (error as Error)?.message || "Failed to import JSON data",
    onSuccess: (result: ImportResult) => {
      setUploadProgress(100);
      setLastResult(result);
      setTimeout(() => setUploadProgress(0), 2000);
    },
    onError: (error: unknown) => {
      const err = error as Error & { errors?: Array<{ message: string }> };
      setUploadProgress(0);
      setLastResult({
        ok: false,
        inserted: 0,
        message: err?.message || "JSON import failed",
        errors: err?.errors,
      });
    },
  });

  const handleCsvImport = useCallback(() => {
    if (!csvData.trim()) {
      toast({
        title: "No Data",
        description: "Please enter CSV data to import",
        variant: "destructive",
      });
      return;
    }
    setUploadProgress(25);
    csvImportMutation.mutate(csvData);
  }, [csvData, csvImportMutation, toast]);
  const handleJsonImport = useCallback(() => {
    if (!jsonData.trim()) {
      toast({
        title: "No Data",
        description: "Please enter JSON data to import",
        variant: "destructive",
      });
      return;
    }
    try {
      JSON.parse(jsonData);
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data",
        variant: "destructive",
      });
      return;
    }
    setUploadProgress(25);
    jsonImportMutation.mutate(jsonData);
  }, [jsonData, jsonImportMutation, toast]);

  const downloadSampleCsv = useCallback(() => {
    const templateCsv = `ts,vessel,src,sig,value,unit\n# Replace with your actual telemetry data\n# Format: ISO timestamp,vessel name,equipment ID,signal name,numeric value,unit`;
    const blob = new Blob([templateCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "telemetry-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);
  const downloadSampleJson = useCallback(() => {
    const templateJson = { _instructions: "Replace with your telemetry data", rows: [] };
    const blob = new Blob([JSON.stringify(templateJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "telemetry-template.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);
  const clearData = useCallback((type: "csv" | "json") => {
    if (type === "csv") {
      setCsvData("");
    } else {
      setJsonData("");
    }
    setLastResult(null);
  }, []);
  const handleRefresh = useCallback(() => {
    toast({ title: "Refreshing telemetry...", description: "Fetching latest data" });
    refetch();
    setTimeout(() => {
      toast({ title: "Telemetry refreshed", description: "Data updated successfully" });
    }, 500);
  }, [refetch, toast]);

  return {
    csvData,
    setCsvData,
    jsonData,
    setJsonData,
    uploadProgress,
    lastResult,
    telemetryData,
    dataLoading,
    csvImportMutation,
    jsonImportMutation,
    handleCsvImport,
    handleJsonImport,
    downloadSampleCsv,
    downloadSampleJson,
    clearData,
    handleRefresh,
  };
}

export type { ImportResult, RawTelemetry };
