import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Eye, Inbox, ListTodo } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AgentChatPanel } from "@/components/agent/AgentChatPanel";
import {
  type UnifiedFindingItem,
  FindingCard,
  TasksSection,
} from "./findings-cards";
import {
  type FindingsSummary,
  FilterBar,
  FindingsPageHeader,
  OutcomeDialog,
  RunOutputDialog,
  SummaryStrip,
} from "./findings-page-parts";

interface FindingsResponse {
  items: UnifiedFindingItem[];
  total: number;
}

export default function FindingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [runOutputItem, setRunOutputItem] = useState<UnifiedFindingItem | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [outcomeAction, setOutcomeAction] = useState<"act" | "dismiss" | "defer">("act");
  const [outcomeSuggestionId, setOutcomeSuggestionId] = useState<string | null>(null);

  const queryFilterParams: Record<string, string | number | null> = {
    limit,
    offset,
    source: sourceFilter !== "all" ? sourceFilter : null,
    severity: severityFilter !== "all" ? severityFilter : null,
    status: statusFilter !== "all" ? statusFilter : null,
    dateFrom: dateFromFilter ? new Date(dateFromFilter).toISOString() : null,
    dateTo: dateToFilter ? new Date(`${dateToFilter}T23:59:59`).toISOString() : null,
  };

  const { data: findings, isLoading: findingsLoading } = useQuery<FindingsResponse>({
    queryKey: ["/api/agent/findings", queryFilterParams],
    refetchInterval: 30000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<FindingsSummary>({
    queryKey: ["/api/agent/findings/summary"],
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Draft approved" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Failed to approve",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const rejectMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Draft rejected" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Failed to reject",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const dismissMutation = useMutation({
    mutationFn: ({
      id,
      outcome,
      outcomeReason,
    }: {
      id: string;
      outcome?: string | undefined;
      outcomeReason?: string | undefined;
    }) => apiRequest("POST", `/api/agent/suggestions/${id}/dismiss`, { outcome, outcomeReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Suggestion dismissed" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Failed to dismiss",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const actMutation = useMutation({
    mutationFn: ({
      id,
      outcome,
      outcomeReason,
    }: {
      id: string;
      outcome?: string | undefined;
      outcomeReason?: string | undefined;
    }) => apiRequest("POST", `/api/agent/suggestions/${id}/act`, { outcome, outcomeReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Marked as acted on" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Failed to act",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const deferMutation = useMutation({
    mutationFn: ({
      id,
      outcome,
      outcomeReason,
    }: {
      id: string;
      outcome?: string | undefined;
      outcomeReason?: string | undefined;
    }) => apiRequest("POST", `/api/agent/suggestions/${id}/defer`, { outcome, outcomeReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Suggestion deferred" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Failed to defer",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const acknowledgeFindingMutation = useMutation({
    mutationFn: (findingId: string) =>
      apiRequest("PATCH", `/api/agent/finding-records/${findingId}`, { status: "acknowledged" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Finding acknowledged" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Failed to acknowledge",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const archiveFindingMutation = useMutation({
    mutationFn: (findingId: string) =>
      apiRequest("PATCH", `/api/agent/finding-records/${findingId}`, { status: "archived" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Finding archived" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Failed to archive",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const openOutcomeDialog = useCallback((action: "act" | "dismiss" | "defer", sugId: string) => {
    setOutcomeAction(action);
    setOutcomeSuggestionId(sugId);
    setOutcomeDialogOpen(true);
  }, []);

  const handleOutcomeSubmit = useCallback(
    (outcome: string, reason: string) => {
      if (!outcomeSuggestionId) {
        return;
      }
      if (outcomeAction === "act") {
        actMutation.mutate({
          id: outcomeSuggestionId,
          outcome,
          outcomeReason: reason || undefined,
        });
      } else if (outcomeAction === "dismiss") {
        dismissMutation.mutate({
          id: outcomeSuggestionId,
          outcome,
          outcomeReason: reason || undefined,
        });
      } else {
        deferMutation.mutate({
          id: outcomeSuggestionId,
          outcome,
          outcomeReason: reason || undefined,
        });
      }
      setOutcomeDialogOpen(false);
      setOutcomeSuggestionId(null);
    },
    [outcomeSuggestionId, outcomeAction, actMutation, dismissMutation, deferMutation]
  );

  const handleOutcomeSkip = useCallback(() => {
    if (!outcomeSuggestionId) {
      return;
    }
    if (outcomeAction === "act") {
      actMutation.mutate({ id: outcomeSuggestionId });
    } else if (outcomeAction === "dismiss") {
      dismissMutation.mutate({ id: outcomeSuggestionId });
    } else {
      deferMutation.mutate({ id: outcomeSuggestionId });
    }
    setOutcomeDialogOpen(false);
    setOutcomeSuggestionId(null);
  }, [outcomeSuggestionId, outcomeAction, actMutation, dismissMutation, deferMutation]);

  const openAssistant = useCallback((item: UnifiedFindingItem) => {
    const prompt = `I'd like help with this finding: "${item.title}". ${item.summary}. What should I do?`;
    setChatMessage(prompt);
    setChatOpen(true);
  }, []);

  const resetFilters = useCallback(() => {
    setSourceFilter("all");
    setSeverityFilter("all");
    setStatusFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setOffset(0);
  }, []);

  const refreshFindings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
  }, [queryClient]);

  const items = findings?.items ?? [];
  const total = findings?.total ?? 0;
  const actionItems = items.filter((i) => i.requiresAction);
  const feedItems = items.filter((i) => !i.requiresAction);

  return (
    <div className="min-h-screen" data-testid="findings-page">
      <FindingsPageHeader onRefresh={refreshFindings} />

      <div className="px-6 py-4">
        <SummaryStrip summary={summary} isLoading={summaryLoading} />

        <Tabs defaultValue="findings" className="w-full">
          <TabsList className="mb-4" data-testid="findings-tabs">
            <TabsTrigger value="findings" data-testid="tab-findings">
              <Eye className="h-4 w-4 mr-1" /> Findings
            </TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">
              <ListTodo className="h-4 w-4 mr-1" /> Tasks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="findings">
            <FilterBar
              source={sourceFilter}
              severity={severityFilter}
              status={statusFilter}
              dateFrom={dateFromFilter}
              dateTo={dateToFilter}
              onSourceChange={(v) => {
                setSourceFilter(v);
                setOffset(0);
              }}
              onSeverityChange={(v) => {
                setSeverityFilter(v);
                setOffset(0);
              }}
              onStatusChange={(v) => {
                setStatusFilter(v);
                setOffset(0);
              }}
              onDateFromChange={(v) => {
                setDateFromFilter(v);
                setOffset(0);
              }}
              onDateToChange={(v) => {
                setDateToFilter(v);
                setOffset(0);
              }}
              onReset={resetFilters}
            />

            {findingsLoading ? (
              <div className="space-y-3" data-testid="findings-loading">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 border rounded-lg" data-testid="findings-empty">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium text-muted-foreground">No findings yet</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Agent suggestions, draft actions, and scheduled run results will appear here.
                </p>
              </div>
            ) : (
              <>
                {actionItems.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <h2 className="text-sm font-semibold">
                        Needs Your Attention ({actionItems.length})
                      </h2>
                    </div>
                    <div className="space-y-2" data-testid="action-items">
                      {actionItems.map((item) => (
                        <FindingCard
                          key={item.id}
                          item={item}
                          onApprove={(id) => approveMutation.mutate(id)}
                          onReject={(id) => rejectMutation.mutate(id)}
                          onDismiss={(id) => openOutcomeDialog("dismiss", id)}
                          onAct={(id) => openOutcomeDialog("act", id)}
                          onDefer={(id) => openOutcomeDialog("defer", id)}
                          onViewOutput={setRunOutputItem}
                          onOpenAssistant={openAssistant}
                          onAcknowledge={(id) => acknowledgeFindingMutation.mutate(id)}
                          onArchive={(id) => archiveFindingMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {feedItems.length > 0 && (
                  <div>
                    {actionItems.length > 0 && (
                      <h2 className="text-sm font-semibold mb-3">All Findings</h2>
                    )}
                    <div className="space-y-2" data-testid="feed-items">
                      {feedItems.map((item) => (
                        <FindingCard
                          key={item.id}
                          item={item}
                          onViewOutput={setRunOutputItem}
                          onOpenAssistant={openAssistant}
                          onAcknowledge={(id) => acknowledgeFindingMutation.mutate(id)}
                          onArchive={(id) => archiveFindingMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {total > limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={offset + limit >= total}
                        onClick={() => setOffset(offset + limit)}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="tasks">
            <TasksSection
              onOpenAssistant={(task) => {
                const prompt = `I'd like help with this task: "${task.title}". ${task.description || ""}. What should I do?`;
                setChatMessage(prompt);
                setChatOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AgentChatPanel
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setChatMessage(null);
        }}
        initialMessage={chatMessage}
      />

      <RunOutputDialog
        item={runOutputItem}
        open={!!runOutputItem}
        onClose={() => setRunOutputItem(null)}
      />

      <OutcomeDialog
        open={outcomeDialogOpen}
        onClose={() => {
          setOutcomeDialogOpen(false);
          setOutcomeSuggestionId(null);
        }}
        action={outcomeAction}
        onSubmit={handleOutcomeSubmit}
        onSkip={handleOutcomeSkip}
      />
    </div>
  );
}
