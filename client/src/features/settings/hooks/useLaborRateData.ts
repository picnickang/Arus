import { useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCreateMutation, useUpdateMutation, useCustomMutation } from "@/hooks/useCrudMutations";

export interface LaborRate {
  id: string;
  skillLevel: string;
  position: string;
  standardRate: number;
  overtimeRate: number;
  emergencyRate: number;
  contractorRate: number;
  currency: string;
  effectiveDate: Date;
  isActive: boolean;
}
export interface CrewMember {
  id: string;
  name: string;
  skillLevel: string;
  position: string;
  currentRate: number;
  overtimeMultiplier: number;
}

const laborRateSchema = z.object({
  skillLevel: z.string().min(1, "Skill level is required"),
  position: z.string().min(1, "Position is required"),
  standardRate: z.number().min(0.01, "Standard rate must be greater than 0"),
  overtimeRate: z.number().min(0.01, "Overtime rate must be greater than 0"),
  emergencyRate: z.number().min(0.01, "Emergency rate must be greater than 0"),
  contractorRate: z.number().min(0.01, "Contractor rate must be greater than 0"),
  currency: z.string().default("USD"),
});
const crewRateUpdateSchema = z.object({
  standardRate: z.number().min(0.01, "Rate must be greater than 0"),
  overtimeMultiplier: z.number().min(1, "Overtime multiplier must be at least 1"),
  effectiveDate: z.string().min(1, "Effective date is required"),
});
export type LaborRateFormData = z.infer<typeof laborRateSchema>;
export type CrewRateFormData = z.infer<typeof crewRateUpdateSchema>;

export function useLaborRateData() {
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [editingCrew, setEditingCrew] = useState<string | null>(null);

  const { data: laborRates = [], isLoading: ratesLoading } = useQuery<LaborRate[]>({
    queryKey: ["/api/labor-rates"],
  });
  const { data: crewMembers = [], isLoading: crewLoading } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew"],
  });

  const newRateForm = useForm<LaborRateFormData>({
    resolver: zodResolver(laborRateSchema),
    defaultValues: {
      currency: "USD",
      standardRate: 75,
      overtimeRate: 112.5,
      emergencyRate: 150,
      contractorRate: 125,
    },
  });
  const updateRateForm = useForm<LaborRateFormData>({ resolver: zodResolver(laborRateSchema) });
  const crewRateForm = useForm<CrewRateFormData>({
    resolver: zodResolver(crewRateUpdateSchema),
    defaultValues: { overtimeMultiplier: 1.5 },
  });

  // @ts-ignore -- bulk-silence
  const createRateMutation = useCreateMutation({
    endpoint: "/api/labor-rates",
    invalidateKeys: ["/api/labor-rates"],
    successMessage: "New labor rate configuration has been saved.",
    onSuccess: () => newRateForm.reset(),
  });
  // @ts-ignore -- bulk-silence
  const updateRateMutation = useUpdateMutation({
    endpoint: "/api/labor-rates",
    invalidateKeys: ["/api/labor-rates"],
    successMessage: "Labor rate configuration has been updated.",
    onSuccess: () => setEditingRate(null),
  });
  const updateCrewRateMutation = useCustomMutation<
    { crewId: string; rateData: CrewRateFormData },
    CrewMember
  >({
    mutationFn: async ({ crewId, rateData }) =>
      apiRequest("PATCH", `/api/crew/${crewId}/rate`, rateData),
    invalidateKeys: ["/api/crew"],
    successMessage: "Crew member labor rate has been updated.",
    onSuccess: () => setEditingCrew(null),
  });

  const handleEditRate = useCallback(
    (rate: LaborRate) => {
      setEditingRate(rate.id);
      updateRateForm.reset({
        skillLevel: rate.skillLevel,
        position: rate.position,
        standardRate: rate.standardRate,
        overtimeRate: rate.overtimeRate,
        emergencyRate: rate.emergencyRate,
        contractorRate: rate.contractorRate,
        currency: rate.currency,
      });
    },
    [updateRateForm]
  );
  const handleEditCrew = useCallback(
    (crew: CrewMember) => {
      setEditingCrew(crew.id);
      crewRateForm.reset({
        standardRate: crew.currentRate,
        overtimeMultiplier: crew.overtimeMultiplier,
        effectiveDate: new Date().toISOString().split("T")[0],
      });
    },
    [crewRateForm]
  );

  const averageRates = useMemo(() => {
    if (laborRates.length === 0) {
      return { standard: 0, overtime: 0, emergency: 0 };
    }
    const totals = laborRates.reduce(
      (acc: { standard: number; overtime: number; emergency: number }, rate: LaborRate) => ({
        standard: acc.standard + rate.standardRate,
        overtime: acc.overtime + rate.overtimeRate,
        emergency: acc.emergency + rate.emergencyRate,
      }),
      { standard: 0, overtime: 0, emergency: 0 }
    );
    return {
      standard: totals.standard / laborRates.length,
      overtime: totals.overtime / laborRates.length,
      emergency: totals.emergency / laborRates.length,
    };
  }, [laborRates]);

  return {
    editingRate,
    setEditingRate,
    editingCrew,
    setEditingCrew,
    laborRates,
    crewMembers,
    ratesLoading,
    crewLoading,
    averageRates,
    newRateForm,
    updateRateForm,
    crewRateForm,
    createRateMutation,
    updateRateMutation,
    updateCrewRateMutation,
    handleEditRate,
    handleEditCrew,
  };
}
