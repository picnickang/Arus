import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Target,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExperienceScoreCard } from "../components/ExperienceScoreCard";
import { SolutionLoopCard } from "../components/SolutionLoopCard";
import { RoleInformationNeedsMatrix } from "../components/RoleInformationNeedsMatrix";
import {
  useOperatorExperienceBrief,
  useOperatorExperienceRoles,
  useRecordOperatorExperienceEvent,
} from "../hooks/useOperatorExperience";
import type { OperatorRole } from "../types";

const DEFAULT_ROLE: OperatorRole = "chief_engineer";

function priorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "immediate") {
    return "destructive";
  }
  if (priority === "urgent") {
    return "secondary";
  }
  if (priority === "soon") {
    return "outline";
  }
  return "default";
}

export default function OperatorExperiencePage() {
  const [role, setRole] = useState<OperatorRole>(DEFAULT_ROLE);
  const [location, navigate] = useLocation();
  const rolesQuery = useOperatorExperienceRoles();
  const briefQuery = useOperatorExperienceBrief({
    role,
    currentPath: location,
    deviceClass: "unknown",
    connectionState: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online",
  });
  const eventMutation = useRecordOperatorExperienceEvent();
  const brief = briefQuery.data;

  useEffect(() => {
    eventMutation.mutate({
      eventType: "page_view",
      role,
      path: location,
      label: "Operator Experience",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, location]);

  const weakestPillar = useMemo(() => {
    if (!brief?.pillarScores.length) {
      return null;
    }
    return [...brief.pillarScores].sort((a, b) => a.score - b.score)[0];
  }, [brief]);

  if (briefQuery.isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Failed to load operator experience brief.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="w-fit">
                Hexagonal UX command layer
              </Badge>
              <CardTitle className="text-2xl md:text-3xl">
                Operator Experience Command Center
              </CardTitle>
              <CardDescription>
                Answers who the user is, what they are trying to do, where they hesitate, and which
                UX action improves trust, conversion, retention, safety, and uptime.
              </CardDescription>
            </div>
            <div className="w-full md:w-72">
              <Select value={role} onValueChange={(value) => setRole(value as OperatorRole)}>
                <SelectTrigger data-testid="select-operator-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(rolesQuery.data ?? []).map((profile) => (
                    <SelectItem key={profile.role} value={profile.role}>
                      {profile.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <Target className="mt-1 h-5 w-5" />
              <div>
                <div className="font-semibold">{brief.executiveSummary}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Success metric: {brief.successMetric}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Attention items</div>
              <div className="text-2xl font-bold">{brief.signals.attentionItems}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Critical</div>
              <div className="text-2xl font-bold">{brief.signals.criticalItems}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Blocked</div>
              <div className="text-2xl font-bold">{brief.signals.blockedItems}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Ready closeout</div>
              <div className="text-2xl font-bold">{brief.signals.readyForCloseout}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <RoleInformationNeedsMatrix role={role} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Highest-value next actions
            </CardTitle>
            <CardDescription>
              Primary CTA guidance based on the current role and operating signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {brief.nextActions.map((action) => (
              <div
                key={action.id}
                className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{action.label}</div>
                    <Badge variant={priorityVariant(action.priority)}>{action.priority}</Badge>
                    <Badge variant="outline">{action.businessImpact}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    eventMutation.mutate({
                      eventType: "cta_click",
                      role,
                      path: location,
                      label: action.label,
                    });
                    navigate(action.href);
                  }}
                >
                  Open <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> User questions
            </CardTitle>
            <CardDescription>The UX plan converted into product answers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {brief.userQuestionsAnswered.map((item) => (
              <div key={item.question} className="rounded-lg border p-3">
                <div className="text-sm font-semibold">{item.question}</div>
                <p className="mt-1 text-xs text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {brief.pillarScores.map((score) => (
          <ExperienceScoreCard key={score.pillar} score={score} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" /> Friction points
            </CardTitle>
            <CardDescription>
              What most likely blocks trust, task completion, or retention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {brief.frictionPoints.map((point) => (
              <div key={point.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">{point.title}</div>
                  <Badge variant={point.priority === "critical" ? "destructive" : "outline"}>
                    {point.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{point.symptom}</p>
                <p className="mt-2 text-xs">
                  <strong>Fix:</strong> {point.fix}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Trust signals
            </CardTitle>
            <CardDescription>
              Evidence users need before acting on operational or AI recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {brief.trustSignals.map((signal) => (
              <div key={signal.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <div className="font-semibold">{signal.label}</div>
                  <Badge variant={signal.status === "present" ? "default" : "outline"}>
                    {signal.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{signal.description}</p>
                <p className="mt-2 text-xs">Evidence: {signal.evidence}</p>
              </div>
            ))}
            {weakestPillar && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                Priority: improve <strong>{weakestPillar.label}</strong> first.{" "}
                {weakestPillar.recommendedImprovement}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SolutionLoopCard solutionMap={brief.solutionMap} />
    </div>
  );
}
