import { useLocation } from "wouter";
import { ArrowRight, BadgeCheck, HelpCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { OperatorRole, RoleInformationNeedSummary } from "../types";
import { useRoleInformationNeeds } from "../hooks/useOperatorExperience";
import {
  businessGoalLabel,
  priorityVariant,
  statusVariant,
} from "../lib/informationNeedsViewModel";

function LoadingMatrix() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-60" />
        <Skeleton className="h-4 w-96" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </CardContent>
    </Card>
  );
}

function SummaryHeader({ summary }: { summary: RoleInformationNeedSummary }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <HelpCircle className="mt-1 h-5 w-5" />
        <div>
          <div className="font-semibold">{summary.primaryQuestion}</div>
          <p className="mt-1 text-sm text-muted-foreground">{summary.headline}</p>
        </div>
      </div>
    </div>
  );
}

export function RoleInformationNeedsMatrix({ role }: { role: OperatorRole }) {
  const [, navigate] = useLocation();
  const { data: summary, isLoading } = useRoleInformationNeeds(role);

  if (isLoading) {
    return <LoadingMatrix />;
  }
  if (!summary) {
    return null;
  }

  return (
    <Card data-testid="card-role-information-needs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5" /> What this user needs to know
        </CardTitle>
        <CardDescription>
          Role-specific information model built from operational signals, UX goals, trust evidence,
          and the next action path.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SummaryHeader summary={summary} />

        <div className="grid gap-3 lg:grid-cols-2">
          {summary.topNeeds.map((need) => (
            <div key={need.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold">{need.title}</div>
                <Badge variant={priorityVariant(need.priority)}>{need.priority}</Badge>
                <Badge variant={statusVariant(need.status)}>{need.status.replace(/_/g, " ")}</Badge>
                <Badge variant="outline">{businessGoalLabel(need.businessGoal)}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{need.userQuestion}</p>
              <p className="mt-2 text-xs">
                <strong>Why now:</strong> {need.reason}
              </p>
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <strong>Needs:</strong> {need.informationNeeded.join(", ")}
                </div>
                <div>
                  <strong>UI pattern:</strong> {need.uiPattern}
                </div>
                <div>
                  <strong>Trust evidence:</strong> {need.trustEvidence.join(", ")}
                </div>
              </div>
              <Button className="mt-3" variant="outline" onClick={() => navigate(need.route)}>
                {need.recommendedCta} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" /> Trust checklist
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {summary.trustChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <div className="font-semibold">UX guidance</div>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <p>
                <strong>Clarity:</strong> {summary.uxGuidance.clarity}
              </p>
              <p>
                <strong>Speed:</strong> {summary.uxGuidance.speed}
              </p>
              <p>
                <strong>Simplicity:</strong> {summary.uxGuidance.simplicity}
              </p>
              <p>
                <strong>Trust:</strong> {summary.uxGuidance.trust}
              </p>
              <p>
                <strong>Retention:</strong> {summary.uxGuidance.retention}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
