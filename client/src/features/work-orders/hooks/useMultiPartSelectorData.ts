// @ts-nocheck
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCustomMutation } from "@/hooks/useCrudMutations";

interface Part {
  id: string;
  partNumber: string;
  partName: string;
  description?: string;
  standardCost?: number;
  stock?: {
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
    availableQuantity: number;
    unitCost: number;
    location?: string;
  };
}

interface SelectedPart {
  partId: string;
  partNumber: string;
  partName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
  availableStock: number;
}

interface CrewMember {
  id: string;
  name: string;
  rank?: string;
  hourlyRate?: number;
}

export interface UseMultiPartSelectorDataReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedParts: SelectedPart[];
  usedBy: string;
  setUsedBy: (value: string) => void;
  availableParts: Part[];
  isLoading: boolean;
  engineers: CrewMember[];
  existingParts: Array<{ partId: string; quantity: number; unitCost: number; totalCost: number }>;
  filteredParts: Part[];
  hasStockWarnings: boolean;
  addPartsMutation: ReturnType<
    typeof useCustomMutation<SelectedPart[], { success: boolean; message?: string }>
  >;
  removePartMutation: ReturnType<
    typeof useCustomMutation<string, { success: boolean; message?: string }>
  >;
  addPartToSelection: (part: Part) => void;
  incrementPartQuantity: (partId: string) => void;
  decrementPartQuantity: (partId: string) => void;
  updatePartQuantity: (partId: string, quantity: number) => void;
  updatePartNotes: (partId: string, notes: string) => void;
  removePartFromSelection: (partId: string) => void;
  getTotalCost: () => number;
  getStockStatus: (part: Part) => { status: string; color: string };
  getStockWarning: (
    part: SelectedPart
  ) => { message: string; severity: "error" | "warning" } | null;
  clearSelection: () => void;
}

export function useMultiPartSelectorData(
  workOrderId: string,
  onPartsAdded?: () => void
): UseMultiPartSelectorDataReturn {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [usedBy, setUsedBy] = useState("");
  const { toast } = useToast();

  const { data: availableParts = [], isLoading } = useQuery<Part[]>({
    queryKey: ["/api/parts-inventory", { search: searchTerm || undefined }],
  });

  const { data: engineers = [] } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew", { role: "engineer" }],
  });

  const { data: existingParts = [] } = useQuery({
    queryKey: ["/api/work-orders", workOrderId, "parts"],
  });

  const addPartsMutation = useCustomMutation<
    SelectedPart[],
    { summary?: { added: number; updated: number; errors: number } }
  >({
    mutationFn: async (parts: SelectedPart[]) => {
      const payload = {
        parts: parts.map((part) => ({
          partId: part.partId,
          quantity: part.quantity,
          usedBy: usedBy || "Unknown",
          notes: part.notes || "",
        })),
      };
      return apiRequest("POST", `/api/work-orders/${workOrderId}/parts/bulk`, payload);
    },
    invalidateKeys: [
      `/api/work-orders/${workOrderId}/parts`,
      "/api/work-orders",
      "/api/parts-inventory",
    ],
    onSuccess: (response) => {
      const summary = response?.summary || { added: 0, updated: 0, errors: 0 };
      toast({
        title: "Parts Added Successfully",
        description: `Added ${summary.added} parts, updated ${summary.updated} parts${summary.errors > 0 ? `, ${summary.errors} errors` : ""}`,
      });
      setSelectedParts([]);
      setUsedBy("");
      onPartsAdded?.();
    },
  });

  const removePartMutation = useCustomMutation<string, void>({
    mutationFn: async (partId: string) => {
      return apiRequest("DELETE", `/api/work-orders/${workOrderId}/parts/${partId}`);
    },
    invalidateKeys: [
      `/api/work-orders/${workOrderId}/parts`,
      "/api/work-orders",
      "/api/parts-inventory",
    ],
    onSuccess: () => {
      toast({
        title: "Part Removed",
        description: "Part has been removed from this work order and returned to inventory.",
      });
      onPartsAdded?.();
    },
  });

  const addPartToSelection = useCallback((part: Part) => {
    setSelectedParts((prev) => {
      const existingIndex = prev.findIndex((p) => p.partId === part.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].totalCost =
          updated[existingIndex].quantity * updated[existingIndex].unitCost;
        return updated;
      }
      const unitCost = part.stock?.unitCost || part.standardCost || 0;
      const availableStock = part.stock?.availableQuantity ?? 0;
      return [
        ...prev,
        {
          partId: part.id,
          partNumber: part.partNumber,
          partName: part.partName,
          quantity: 1,
          unitCost,
          totalCost: unitCost,
          availableStock,
        },
      ];
    });
  }, []);

  const incrementPartQuantity = useCallback((partId: string) => {
    setSelectedParts((prev) =>
      prev.map((part) =>
        part.partId === partId
          ? { ...part, quantity: part.quantity + 1, totalCost: (part.quantity + 1) * part.unitCost }
          : part
      )
    );
  }, []);

  const decrementPartQuantity = useCallback((partId: string) => {
    setSelectedParts((prev) => {
      const part = prev.find((p) => p.partId === partId);
      if (!part || part.quantity <= 1) {
        return prev;
      }
      return prev.map((p) =>
        p.partId === partId
          ? { ...p, quantity: p.quantity - 1, totalCost: (p.quantity - 1) * p.unitCost }
          : p
      );
    });
  }, []);

  const updatePartQuantity = useCallback((partId: string, quantity: number) => {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    setSelectedParts((prev) =>
      prev.map((part) =>
        part.partId === partId
          ? { ...part, quantity: safeQuantity, totalCost: safeQuantity * part.unitCost }
          : part
      )
    );
  }, []);

  const updatePartNotes = useCallback((partId: string, notes: string) => {
    setSelectedParts((prev) =>
      prev.map((part) => (part.partId === partId ? { ...part, notes } : part))
    );
  }, []);

  const removePartFromSelection = useCallback((partId: string) => {
    setSelectedParts((prev) => prev.filter((p) => p.partId !== partId));
  }, []);

  const getTotalCost = useCallback(
    () => selectedParts.reduce((total, part) => total + part.totalCost, 0),
    [selectedParts]
  );

  const getStockStatus = useCallback((part: Part) => {
    if (!part.stock) {
      return { status: "unknown", color: "bg-gray-500" };
    }
    const available = part.stock.availableQuantity;
    if (available === 0) {
      return { status: "Out of Stock", color: "bg-red-500" };
    }
    if (available < 5) {
      return { status: "Low Stock", color: "bg-yellow-500" };
    }
    return { status: "In Stock", color: "bg-green-500" };
  }, []);

  const getStockWarning = useCallback((part: SelectedPart) => {
    const available = part.availableStock;
    if (available === 0 && part.quantity > 0) {
      return { message: `Out of stock (0 available)`, severity: "error" as const };
    }
    if (part.quantity > available) {
      return {
        message: `Requested ${part.quantity} but only ${available} available`,
        severity: "error" as const,
      };
    }
    if (available > 0 && part.quantity > available * 0.8) {
      return {
        message: `Using ${Math.round((part.quantity / available) * 100)}% of available stock`,
        severity: "warning" as const,
      };
    }
    return null;
  }, []);

  const hasStockWarnings = useMemo(
    () => selectedParts.some((part) => getStockWarning(part)?.severity === "error"),
    [selectedParts, getStockWarning]
  );

  const filteredParts = useMemo(
    () =>
      (Array.isArray(availableParts) ? availableParts : []).filter(
        (part) =>
          part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.partName.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [availableParts, searchTerm]
  );

  const clearSelection = useCallback(() => setSelectedParts([]), []);

  return {
    searchTerm,
    setSearchTerm,
    selectedParts,
    usedBy,
    setUsedBy,
    availableParts: availableParts ?? [],
    isLoading,
    engineers,
    existingParts,
    filteredParts,
    hasStockWarnings,
    addPartsMutation,
    removePartMutation,
    addPartToSelection,
    incrementPartQuantity,
    decrementPartQuantity,
    updatePartQuantity,
    updatePartNotes,
    removePartFromSelection,
    getTotalCost,
    getStockStatus,
    getStockWarning,
    clearSelection,
  };
}
