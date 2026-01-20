import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

interface ActionableInsight { id: string; orgId: string; equipmentId: string; vesselId: string | null; type: string; severity: "critical" | "high" | "medium" | "low"; title: string; message: string; supportingSignals: Record<string, unknown> | null; recommendedAction: string | null; relatedProcedures: string[] | null; acknowledged: boolean; acknowledgedAt: Date | null; acknowledgedBy: string | null; resolved: boolean; resolvedAt: Date | null; resolvedBy: string | null; resolutionNotes: string | null; workOrderId: string | null; createdAt: Date; equipment?: { id: string; name: string; type: string }; }
interface InsightStats { total: number; critical: number; high: number; medium: number; low: number; resolved: number; unresolved: number; }

export function useActionableInsightsData() {
  const { currentOrgId } = useOrganization();
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<ActionableInsight | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<InsightStats>({ queryKey: ["/api/insights/stats/summary", currentOrgId], queryFn: async () => { if (!currentOrgId) {throw new Error("No organization selected");} const response = await fetch(`/api/insights/stats/summary?orgId=${currentOrgId}`, { headers: { "x-org-id": currentOrgId } }); if (!response.ok) {throw new Error("Failed to fetch stats");} return response.json(); }, enabled: !!currentOrgId });
  const { data: insights = [], isLoading: insightsLoading } = useQuery<ActionableInsight[]>({ queryKey: ["/api/insights", currentOrgId, selectedSeverity, showResolved ? "all" : "unresolved"], queryFn: async () => { if (!currentOrgId) {throw new Error("No organization selected");} const params = new URLSearchParams({ orgId: currentOrgId }); if (selectedSeverity) {params.append("severity", selectedSeverity);} if (!showResolved) {params.append("resolved", "false");} const response = await fetch(`/api/insights?${params.toString()}`, { headers: { "x-org-id": currentOrgId } }); if (!response.ok) {throw new Error("Failed to fetch insights");} return response.json(); }, enabled: !!currentOrgId });

  const acknowledgeMutation = useMutation({ mutationFn: async (insightId: string) => { if (!currentOrgId) {throw new Error("No organization selected");} return apiRequest(`/api/insights/${insightId}/acknowledge`, { method: "PATCH", body: JSON.stringify({ orgId: currentOrgId, acknowledgedBy: "Current User" }), headers: { "Content-Type": "application/json" } }); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/insights"] }); queryClient.invalidateQueries({ queryKey: ["/api/insights/stats/summary"] }); toast({ title: "Insight acknowledged successfully" }); }, onError: (error: Error) => { toast({ title: "Error", description: error?.message || "Failed to acknowledge insight", variant: "destructive" }); } });
  const resolveMutation = useMutation({ mutationFn: async ({ insightId, notes }: { insightId: string; notes: string }) => { if (!currentOrgId) {throw new Error("No organization selected");} return apiRequest(`/api/insights/${insightId}/resolve`, { method: "PATCH", body: JSON.stringify({ orgId: currentOrgId, resolvedBy: "Current User", resolutionNotes: notes }), headers: { "Content-Type": "application/json" } }); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/insights"] }); queryClient.invalidateQueries({ queryKey: ["/api/insights/stats/summary"] }); toast({ title: "Insight resolved successfully" }); setResolveDialogOpen(false); setDetailsOpen(false); setResolutionNotes(""); }, onError: (error: Error) => { toast({ title: "Error", description: error?.message || "Failed to resolve insight", variant: "destructive" }); } });

  const handleAcknowledge = useCallback((insightId: string) => { acknowledgeMutation.mutate(insightId); }, [acknowledgeMutation]);
  const handleResolve = useCallback(() => { if (selectedInsight) {resolveMutation.mutate({ insightId: selectedInsight.id, notes: resolutionNotes });} }, [selectedInsight, resolutionNotes, resolveMutation]);
  const handleSelectInsight = useCallback((insight: ActionableInsight) => { setSelectedInsight(insight); setDetailsOpen(true); }, []);
  const toggleShowResolved = useCallback(() => { setShowResolved((prev) => !prev); }, []);

  const isLoading = statsLoading || insightsLoading;

  return { stats, insights, isLoading, insightsLoading, selectedSeverity, setSelectedSeverity, showResolved, toggleShowResolved, selectedInsight, detailsOpen, setDetailsOpen, resolveDialogOpen, setResolveDialogOpen, resolutionNotes, setResolutionNotes, handleAcknowledge, handleResolve, handleSelectInsight, acknowledgeMutation, resolveMutation };
}

export type { ActionableInsight, InsightStats };
