import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle,
  Wrench,
  Shield,
  Package,
  Activity,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";

interface BriefingSectionItem {
  id: string;
  title: string;
  description: string;
  severity?: "info" | "warning" | "critical";
  entityType?: string;
  entityId?: string;
  linkTo?: string;
  metadata?: Record<string, unknown>;
}

interface BriefingSection {
  key: string;
  title: string;
  icon?: string;
  items: BriefingSectionItem[];
  emptyMessage?: string;
}

interface Briefing {
  id: string;
  orgId: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  sections: BriefingSection[];
  aiSummary: string | null;
  status: string;
  scheduleRunId: string | null;
  createdAt: string;
}

const SECTION_ICONS: Record<string, typeof AlertTriangle> = {
  AlertTriangle,
  CheckCircle,
  Wrench,
  Shield,
  Package,
  Activity,
};

function getSectionIcon(iconName?: string) {
  if (!iconName) {
    return FileText;
  }
  return SECTION_ICONS[iconName] || FileText;
}

function SeverityBadge({ severity }: { severity?: string }) {
  if (!severity || severity === "info") {
    return null;
  }
  return (
    <Badge
      variant={severity === "critical" ? "destructive" : "secondary"}
      className="text-xs"
      data-testid={`badge-severity-${severity}`}
    >
      {severity}
    </Badge>
  );
}

function BriefingSectionCard({ section }: { section: BriefingSection }) {
  const [expanded, setExpanded] = useState(section.items.length <= 5);
  const Icon = getSectionIcon(section.icon);
  const criticalCount = section.items.filter((i) => i.severity === "critical").length;

  return (
    <Card data-testid={`section-${section.key}`}>
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setExpanded(!expanded)}
        data-testid={`section-header-${section.key}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{section.title}</CardTitle>
            <Badge variant="outline" className="text-xs" data-testid={`badge-count-${section.key}`}>
              {section.items.length}
            </Badge>
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} critical
              </Badge>
            )}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0" data-testid={`section-content-${section.key}`}>
          {section.items.length === 0 ? (
            <p
              className="text-sm text-muted-foreground italic"
              data-testid={`section-empty-${section.key}`}
            >
              {section.emptyMessage || "No items."}
            </p>
          ) : (
            <div className="space-y-2">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-3"
                  data-testid={`item-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{item.title}</span>
                      <SeverityBadge severity={item.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  {item.linkTo && (
                    <Link href={item.linkTo}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        data-testid={`link-${item.id}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function BriefingPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const latestQuery = useQuery<Briefing | null>({
    queryKey: ["/api/agent/briefings/latest"],
    enabled: isToday,
    refetchInterval: isToday ? 60000 : false,
  });

  const dateQuery = useQuery<Briefing[]>({
    queryKey: ["/api/agent/briefings", selectedDate],
    queryFn: () =>
      apiRequest<Briefing[]>("GET", `/api/agent/briefings?date=${selectedDate}`),
    enabled: !isToday,
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agent/briefings/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/briefings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/briefings/latest"] });
      toast({
        title: "Briefing generated",
        description: "Your daily operations briefing is ready.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const briefing: Briefing | null = isToday
    ? (latestQuery.data ?? null)
    : (dateQuery.data?.[0] ?? null);

  useEffect(() => {
    if (briefing?.id && isToday) {
      localStorage.setItem("briefing-viewed-id", briefing.id);
    }
  }, [briefing?.id, isToday]);

  const isLoading = isToday ? latestQuery.isLoading : dateQuery.isLoading;

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const sections: BriefingSection[] = briefing?.sections
    ? Array.isArray(briefing.sections)
      ? briefing.sections
      : []
    : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" data-testid="page-briefing">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Daily Operations Briefing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shift handover summary — what happened and what needs attention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeDate(-1)}
            data-testid="button-prev-day"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border rounded px-2 py-1 text-sm"
              data-testid="input-date-picker"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeDate(1)}
            disabled={isToday}
            data-testid="button-next-day"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4" data-testid="loading-skeleton">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !briefing ? (
        <Card data-testid="card-empty-state">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">No briefing available</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isToday
                  ? "No briefing has been generated for today yet."
                  : `No briefing found for ${new Date(selectedDate).toLocaleDateString()}.`}
              </p>
            </div>
            {isToday && (
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-now"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Generate Now
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {briefing.aiSummary && (
            <Card data-testid="card-ai-summary">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Executive Summary
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs"
                      data-testid="badge-briefing-status"
                    >
                      {briefing.status}
                    </Badge>
                    <span
                      className="text-xs text-muted-foreground"
                      data-testid="text-generated-time"
                    >
                      {new Date(briefing.generatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed" data-testid="text-ai-summary">
                  {briefing.aiSummary}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground" data-testid="text-period">
              Period: {new Date(briefing.periodStart).toLocaleString()} —{" "}
              {new Date(briefing.periodEnd).toLocaleString()}
            </p>
            {isToday && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-regenerate"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Regenerate
              </Button>
            )}
          </div>

          {sections.map((section) => (
            <BriefingSectionCard key={section.key} section={section} />
          ))}

          {sections.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No section data available for this briefing.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
