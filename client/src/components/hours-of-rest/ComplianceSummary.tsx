import { TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { type calculateSummaryStats } from "@/features/crew";

interface ComplianceSummaryProps {
  summaryStats: ReturnType<typeof calculateSummaryStats>;
}

export function ComplianceSummary({ summaryStats }: ComplianceSummaryProps) {
  return (
    <CollapsibleSection
      title="Compliance Summary"
      description="Month overview and compliance statistics"
      icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
      defaultExpanded
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-lg" data-testid="stat-compliance-rate">
          <p className="text-sm text-muted-foreground">Compliance Rate</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{summaryStats.complianceRate}%</p>
          <Progress value={Number.parseFloat(summaryStats.complianceRate)} className="mt-2 h-2" />
          <p className="text-xs text-muted-foreground mt-1">{summaryStats.compliantDays}/{summaryStats.totalDays} days</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg" data-testid="stat-avg-rest">
          <p className="text-sm text-muted-foreground">Avg Rest/Day</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summaryStats.avgRest}h</p>
          <p className="text-xs text-muted-foreground mt-1">Total: {summaryStats.totalRest}h this month</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 rounded-lg" data-testid="stat-violations">
          <p className="text-sm text-muted-foreground">Violations</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{summaryStats.violations}</p>
          <p className="text-xs text-muted-foreground mt-1">{summaryStats.criticalViolations} critical (&lt;8h)</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg" data-testid="stat-longest-work">
          <p className="text-sm text-muted-foreground">Longest Work</p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{summaryStats.longestWork}h</p>
          <p className="text-xs text-muted-foreground mt-1">Continuous period</p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
