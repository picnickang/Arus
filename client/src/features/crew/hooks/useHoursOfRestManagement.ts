import { apiFormDataRequest, apiRequest } from "@/lib/queryClient";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCustomMutation } from "@/hooks/useCrudMutations";

interface Crew {
  id: string;
  name: string;
  rank: string;
  vesselId?: string;
}

interface RestSheetData {
  sheet: {
    id: string;
    crewId: string;
    year: number;
    month: string;
    vesselId?: string;
    createdAt: string;
  } | null;
  days: Array<{
    id: string;
    sheetId: string;
    date: string;
    hourlyFlags: string;
  }>;
}

interface ComplianceResult {
  compliant: boolean;
  violations: Array<{ date: string; type: string; message: string }>;
  summary: { totalDays: number; violationDays: number; compliancePercentage: number };
}

const stcwRestKeys = {
  crew: ["/api/crew"] as const,
  rest: (crewId: string, year: number, month: string) =>
    ["/api/stcw/rest", crewId, year, month] as const,
};

export const MONTHS_LIST = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function useHoursOfRestManagement() {
  const { toast } = useToast();
  const [selectedCrew, setSelectedCrew] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(
    (new Date().getMonth() + 1).toString().padStart(2, "0")
  );
  const [importFile, setImportFile] = useState<File | null>(null);
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);

  const { data: crew = [], isLoading: crewLoading } = useQuery<Crew[]>({
    queryKey: stcwRestKeys.crew,
    refetchInterval: 60000,
  });

  const {
    data: restData,
    isLoading: restLoading,
    refetch: refetchRestData,
  } = useQuery<RestSheetData>({
    queryKey: stcwRestKeys.rest(selectedCrew, selectedYear, selectedMonth),
    enabled: !!selectedCrew,
    refetchInterval: 60000,
    queryFn: async () =>
      apiRequest("GET", `/api/stcw/rest/${selectedCrew}/${selectedYear}/${selectedMonth}`),
  });

  const importMutation = useCustomMutation({
    mutationFn: async (formData: FormData) =>
      apiFormDataRequest<{ sheets: number }>("POST", "/api/stcw/import", formData),
    invalidateKeys: [
      stcwRestKeys.crew,
      stcwRestKeys.rest(selectedCrew, selectedYear, selectedMonth),
    ] as never,
    successMessage: (data) => `Imported rest data for ${data.sheets} crew members`,
    onSuccess: () => {
      setImportFile(null);
      refetchRestData();
    },
  });

  const complianceMutation = useCustomMutation({
    mutationFn: async (params: { crewId: string; year: number; month: string }) =>
      apiRequest<ComplianceResult>(
        "GET",
        `/api/stcw/compliance/${params.crewId}/${params.year}/${params.month}`
      ),
    successMessage: (data) => `${data.compliant ? "Compliant" : "Violations found"}`,
    onSuccess: (data) => setComplianceResult(data),
  });

  const handleImport = useCallback(() => {
    if (!importFile) {
      toast({ title: "Please select a file", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("file", importFile);
    importMutation.mutate(formData);
  }, [importFile, importMutation, toast]);

  const handleCheckCompliance = useCallback(() => {
    if (!selectedCrew) {
      return;
    }
    complianceMutation.mutate({ crewId: selectedCrew, year: selectedYear, month: selectedMonth });
  }, [selectedCrew, selectedYear, selectedMonth, complianceMutation]);

  const handleExportPDF = useCallback(async () => {
    if (!selectedCrew) {
      toast({ title: "Please select a crew member", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(
        `/api/stcw/export/${selectedCrew}/${selectedYear}/${selectedMonth}`
      );
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stcw_rest_${selectedCrew}_${selectedYear}_${selectedMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "PDF exported successfully" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }, [selectedCrew, selectedYear, selectedMonth, toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setImportFile(e.target.files?.[0] || null);
  }, []);

  const calendarGrid = useMemo(() => {
    if (!restData?.days) {
      return null;
    }
    const daysInMonth = new Date(selectedYear, Number.parseInt(selectedMonth), 0).getDate();
    const grid = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${selectedMonth.padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      const dayData = restData.days?.find((d) => d.date === dateStr);
      const hourlyFlags = dayData?.hourlyFlags || "000000000000000000000000";
      const restHours = (hourlyFlags.match(/1/g) ?? []).length;
      grid.push({ day, date: dateStr, restHours, hourlyFlags, compliant: restHours >= 10 });
    }
    return grid;
  }, [restData, selectedYear, selectedMonth]);

  const years = useMemo(
    () => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i),
    []
  );

  const selectedMonthLabel = useMemo(
    () => MONTHS_LIST.find((m) => m.value === selectedMonth)?.label || "",
    [selectedMonth]
  );

  return {
    crew,
    crewLoading,
    restLoading,
    selectedCrew,
    setSelectedCrew,
    selectedYear,
    setSelectedYear: (year: number | string) =>
      setSelectedYear(typeof year === "string" ? Number.parseInt(year) : year),
    selectedMonth,
    setSelectedMonth,
    selectedMonthLabel,
    importFile,
    handleFileChange,
    handleImport,
    importMutation,
    handleCheckCompliance,
    complianceMutation,
    handleExportPDF,
    complianceResult,
    calendarGrid,
    months: MONTHS_LIST,
    years,
  };
}
