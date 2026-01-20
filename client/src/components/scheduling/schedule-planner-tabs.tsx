import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  AlertTriangle, AlertCircle, Calendar, Ship, Users, Sparkles, 
  CheckCircle2, Shield, FileText
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { 
  type ScheduleAssignment, 
  type ConstraintResult, 
  type AiSuggestion,
  type FatigueResult,
  type FatigueRiskLevel
} from "@/features/crew/hooks/useSchedulePlannerData";
import { cn } from "@/lib/utils";
import { getStatusBadge, ROLE_COLORS } from "./schedule-planner-utils";

export function FatigueRiskBadge({ riskLevel, compact = false }: { riskLevel: FatigueRiskLevel; compact?: boolean }) {
  const config: Record<FatigueRiskLevel, { bg: string; label: string }> = {
    low: { bg: "bg-green-500", label: "Low" },
    medium: { bg: "bg-yellow-500", label: "Med" },
    high: { bg: "bg-orange-500", label: "High" },
    critical: { bg: "bg-red-500", label: "Crit" },
  };
  
  const { bg, label } = config[riskLevel] || config.low;
  
  if (compact) {
    return (
      <span 
        className={cn("w-2 h-2 rounded-full shrink-0", bg)}
        title={`Fatigue Risk: ${label}`}
        data-testid={`fatigue-badge-${riskLevel}`}
      />
    );
  }
  
  return (
    <Badge 
      variant="secondary" 
      className={cn("text-white text-[10px] px-1 py-0 h-4", bg)}
      data-testid={`fatigue-badge-${riskLevel}`}
    >
      {label}
    </Badge>
  );
}

export function DetailsTab({ assignment }: { assignment: ScheduleAssignment }) {
  const statusBadge = getStatusBadge(assignment.status);
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{assignment.crewName.split(" ").map(n => n[0]).join("").slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{assignment.crewName}</p>
          <p className="text-sm text-muted-foreground">{assignment.role}</p>
        </div>
      </div>
      <Separator />
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{assignment.vesselName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {format(parseISO(assignment.startDate), "MMM d, yyyy")} - {format(parseISO(assignment.endDate), "MMM d, yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </div>
      {assignment.notes && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{assignment.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}

export function ConstraintsTab({ violations }: { violations: ConstraintResult[] }) {
  const hardViolations = violations.filter(v => v.severity === "HARD");
  const softViolations = violations.filter(v => v.severity === "SOFT");

  if (violations.length === 0) {
    return (
      <div className="p-4 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
        <p className="font-medium">No Constraint Violations</p>
        <p className="text-sm text-muted-foreground">This assignment meets all requirements.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {hardViolations.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Hard Constraints ({hardViolations.length})
          </h4>
          <div className="space-y-2">
            {hardViolations.map((v, i) => (
              <Card key={i} className="border-red-200 dark:border-red-900">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="shrink-0">HARD</Badge>
                    <div>
                      <p className="text-sm font-medium">{v.code.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{v.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {softViolations.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Soft Warnings ({softViolations.length})
          </h4>
          <div className="space-y-2">
            {softViolations.map((v, i) => (
              <Card key={i} className="border-amber-200 dark:border-amber-900">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-amber-500 shrink-0">SOFT</Badge>
                    <div>
                      <p className="text-sm font-medium">{v.code.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{v.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SuggestionsTab({ 
  suggestions, 
  onApply,
  isPending
}: { 
  suggestions: AiSuggestion[];
  onApply: (crewId: string) => void;
  isPending: boolean;
}) {
  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-center">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="font-medium">No Suggestions Available</p>
        <p className="text-sm text-muted-foreground">No alternative crew members found for this slot.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Crew Pool ({suggestions.length})</span>
        </div>
        {suggestions.map(suggestion => (
          <Card key={suggestion.id} data-testid={`suggestion-${suggestion.id}`}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {suggestion.suggestedCrewName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{suggestion.suggestedCrewName}</p>
                    <p className="text-xs text-muted-foreground">{suggestion.suggestedCrewRank || "Crew"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {suggestion.availability === "available" && (
                    <Badge className="bg-green-500 text-[10px]">AVAIL</Badge>
                  )}
                  {suggestion.availability === "on_duty" && (
                    <Badge variant="secondary" className="text-[10px]">ON DUTY</Badge>
                  )}
                  {suggestion.certStatus === "expiring" && (
                    <Badge className="bg-amber-500 text-[10px]">CERT EXP</Badge>
                  )}
                  {suggestion.constraints && suggestion.constraints.some(c => c.includes("SOFT")) && (
                    <Badge className="bg-amber-500 text-[10px]">SOFT</Badge>
                  )}
                  {suggestion.availability === "leave" && (
                    <Badge variant="outline" className="text-[10px]">COMMIT</Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{suggestion.reason}</p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Score:</span>
                  <span className="text-xs font-medium">{Math.round(suggestion.score * 100)}%</span>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => onApply(suggestion.suggestedCrewId)}
                  disabled={isPending}
                  data-testid={`button-apply-${suggestion.id}`}
                >
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

export function ComplianceTab({ 
  assignment, 
  fatigue 
}: { 
  assignment: ScheduleAssignment; 
  fatigue?: FatigueResult;
}) {
  const getComplianceStatus = () => {
    if (!fatigue) return { status: "UNKNOWN", color: "text-muted-foreground", bg: "bg-muted" };
    switch (fatigue.riskLevel) {
      case "critical":
        return { status: "NON-COMPLIANT", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" };
      case "high":
        return { status: "AT RISK", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" };
      case "medium":
        return { status: "CAUTION", color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30" };
      case "low":
        return { status: "LEGAL", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" };
      default:
        return { status: "UNKNOWN", color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  const compliance = getComplianceStatus();

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="p-4 space-y-4">
        <div className={cn("p-4 rounded-md", compliance.bg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="font-medium">STCW Compliance Status</span>
            </div>
            <Badge className={cn("font-bold", compliance.color, compliance.bg)}>
              {compliance.status}
            </Badge>
          </div>
        </div>

        {fatigue ? (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fatigue Risk Level</span>
                  <FatigueRiskBadge riskLevel={fatigue.riskLevel} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Rest Hour Metrics (14-day lookback)</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Avg Rest/24h</p>
                      <p className="font-medium">{fatigue.metrics.avgRestPer24h?.toFixed(1) || "N/A"}h <span className="text-xs text-muted-foreground">(min: 10h)</span></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Rest/7d</p>
                      <p className="font-medium">{fatigue.metrics.avgRestPer7d?.toFixed(1) || "N/A"}h <span className="text-xs text-muted-foreground">(max work: 77h)</span></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sleep Debt (24h)</p>
                      <p className={cn("font-medium", fatigue.metrics.sleepDebt24h > 2 ? "text-red-500" : "")}>{fatigue.metrics.sleepDebt24h?.toFixed(1) || 0}h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sleep Debt (7d)</p>
                      <p className={cn("font-medium", fatigue.metrics.sleepDebt7d > 10 ? "text-red-500" : "")}>{fatigue.metrics.sleepDebt7d?.toFixed(1) || 0}h</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {fatigue.factors.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Contributing Factors</p>
                  <ul className="space-y-1">
                    {fatigue.factors.map((factor, i) => (
                      <li key={i} className="text-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              <p>No fatigue data available for this assignment.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
