import { useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCreateMutation, useCustomMutation } from "@/hooks/useCrudMutations";

export interface Expense {
  id: string;
  type:
    | "vendor_invoice"
    | "labor_cost"
    | "downtime_cost"
    | "emergency_repair"
    | "port_fees"
    | "fuel_cost"
    | "other";
  amount: number;
  currency: string;
  description: string;
  vendor?: string;
  invoiceNumber?: string;
  workOrderId?: string;
  vesselName?: string;
  expenseDate: Date;
  approvalStatus: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: Date;
  receipt?: string;
  notes?: string;
  createdAt: Date;
}
interface VesselOption {
  id: string;
  name: string;
}
interface EquipmentOption {
  id: string;
  name: string;
}

const expenseSchema = z.object({
  type: z.enum([
    "vendor_invoice",
    "labor_cost",
    "downtime_cost",
    "emergency_repair",
    "port_fees",
    "fuel_cost",
    "other",
  ]),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string().default("USD"),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().optional(),
  invoiceNumber: z.string().optional(),
  workOrderId: z.string().optional(),
  vesselName: z.string().optional(),
  expenseDate: z.string().min(1, "Expense date is required"),
  notes: z.string().optional(),
});
const downtimeSchema = z.object({
  vesselName: z.string().min(1, "Vessel name is required"),
  equipmentId: z.string().min(1, "Equipment is required"),
  downtimeStart: z.string().min(1, "Start time is required"),
  downtimeEnd: z.string().min(1, "End time is required"),
  reason: z.string().min(1, "Reason is required"),
  hourlyLossRate: z.number().min(0.01, "Hourly loss rate must be greater than 0"),
  description: z.string().optional(),
});
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type DowntimeFormData = z.infer<typeof downtimeSchema>;

export function useExpenseTrackingData() {
  const [activeTab, setActiveTab] = useState<"add" | "track" | "downtime">("add");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });
  const { data: vessels = [] } = useQuery<VesselOption[]>({ queryKey: ["/api/vessels"] });
  const { data: equipment = [] } = useQuery<EquipmentOption[]>({ queryKey: ["/api/equipment"] });

  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { currency: "USD", expenseDate: new Date().toISOString().split("T")[0] },
  });
  const downtimeForm = useForm<DowntimeFormData>({
    resolver: zodResolver(downtimeSchema),
    defaultValues: { hourlyLossRate: 500 },
  });

  // @ts-ignore -- bulk-silence
  const createExpenseMutation = useCreateMutation({
    endpoint: "/api/expenses",
    invalidateKeys: ["/api/expenses"],
    successMessage: "Expense has been successfully recorded.",
    onSuccess: () => expenseForm.reset(),
  });
  const createDowntimeMutation = useCustomMutation<DowntimeFormData, Expense>({
    mutationFn: async (downtimeData) => {
      const start = new Date(downtimeData.downtimeStart);
      const end = new Date(downtimeData.downtimeEnd);
      const hoursDown = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const totalCost = hoursDown * downtimeData.hourlyLossRate;
      const expenseData = {
        type: "downtime_cost" as const,
        amount: totalCost,
        currency: "USD",
        description: `Downtime: ${downtimeData.reason} - ${hoursDown.toFixed(2)} hours @ $${downtimeData.hourlyLossRate}/hr`,
        vesselName: downtimeData.vesselName,
        expenseDate: downtimeData.downtimeStart.split("T")[0],
        notes: downtimeData.description,
      };
      return apiRequest("POST", "/api/expenses", expenseData);
    },
    invalidateKeys: ["/api/expenses"],
    successMessage: "Downtime cost has been calculated and recorded.",
    onSuccess: () => downtimeForm.reset(),
  });
  const approveExpenseMutation = useCustomMutation<
    { expenseId: string; action: "approve" | "reject" },
    Expense
  >({
    mutationFn: async ({ expenseId, action }) =>
      apiRequest("POST", `/api/expenses/${expenseId}/${action}`, {}),
    invalidateKeys: ["/api/expenses"],
    successMessage: "Expense approval status has been updated.",
  });

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense: Expense) => {
        const matchesSearch =
          expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || expense.approvalStatus === statusFilter;
        const matchesType = typeFilter === "all" || expense.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [expenses, searchTerm, statusFilter, typeFilter]
  );

  const stats = useMemo(() => {
    const totalExpenses = expenses.reduce((sum: number, exp: Expense) => sum + exp.amount, 0);
    const pendingExpenses = expenses.filter((exp: Expense) => exp.approvalStatus === "pending");
    const approvedExpenses = expenses.filter((exp: Expense) => exp.approvalStatus === "approved");
    const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;
    return {
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      avgExpense,
      pendingAmount: pendingExpenses.reduce((sum, exp) => sum + exp.amount, 0),
      approvedAmount: approvedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
    };
  }, [expenses]);

  const getExpenseTypeLabel = useCallback((type: string) => {
    const labels: Record<string, string> = {
      vendor_invoice: "Vendor Invoice",
      labor_cost: "Labor Cost",
      downtime_cost: "Downtime Cost",
      emergency_repair: "Emergency Repair",
      port_fees: "Port Fees",
      fuel_cost: "Fuel Cost",
      other: "Other",
    };
    return labels[type] || type;
  }, []);
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "approved":
        return "success";
      case "rejected":
        return "destructive";
      default:
        return "warning";
    }
  }, []);

  return {
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    expenses,
    isLoading,
    vessels,
    equipment,
    filteredExpenses,
    stats,
    expenseForm,
    downtimeForm,
    createExpenseMutation,
    createDowntimeMutation,
    approveExpenseMutation,
    getExpenseTypeLabel,
    getStatusColor,
  };
}
