import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Loader2, Bot } from "lucide-react";
import { Link } from "wouter";
import {
  ActivityRow,
  SummaryMetrics,
  type AgentActivityListItem,
  type AgentActivitySummary,
} from "./agent-activity-parts";

export default function AgentActivityPage() {
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const queryParams = new URLSearchParams();
  if (triggerFilter !== "all") {
    queryParams.set("triggerType", triggerFilter);
  }
  if (statusFilter !== "all") {
    queryParams.set("status", statusFilter);
  }
  if (startDate) {
    queryParams.set("startDate", new Date(startDate).toISOString());
  }
  if (endDate) {
    queryParams.set("endDate", new Date(`${endDate}T23:59:59`).toISOString());
  }
  queryParams.set("limit", "50");

  const { data: summary, isLoading: summaryLoading } = useQuery<AgentActivitySummary>({
    queryKey: ["/api/agent/activity/summary"],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<AgentActivityListItem[]>({
    queryKey: ["/api/agent/activity", triggerFilter, statusFilter, startDate, endDate],
    queryFn: async () => {
      return apiRequest("GET", `/api/agent/activity?${queryParams.toString()}`);
    },
  });

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto" data-testid="agent-activity-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            data-testid="heading-agent-activity"
          >
            <Activity className="h-6 w-6" /> Agent Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All agent runs — scheduled and user-initiated
          </p>
        </div>
        <Link href="/copilot-admin">
          <Button variant="outline" size="sm" data-testid="link-copilot-admin">
            <Bot className="h-4 w-4 mr-1" /> Copilot Admin
          </Button>
        </Link>
      </div>

      {summaryLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SummaryMetrics summary={summary} />
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap" data-testid="activity-filters">
        <Select value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-trigger-filter">
            <SelectValue placeholder="Trigger Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Triggers</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">From</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[140px] h-9 text-xs"
            data-testid="input-start-date"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">To</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[140px] h-9 text-xs"
            data-testid="input-end-date"
          />
        </div>

        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            data-testid="button-clear-dates"
          >
            Clear dates
          </Button>
        )}

        {items.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto" data-testid="text-result-count">
            {items.length} result{items.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {itemsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div
          className="text-center py-12 text-muted-foreground border rounded-lg"
          data-testid="empty-activity"
        >
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No agent activity found</p>
          <p className="text-xs mt-1">
            Activity will appear here as the Copilot processes requests and scheduled runs.
          </p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="activity-list">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
