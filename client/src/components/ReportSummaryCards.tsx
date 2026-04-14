import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";

interface ReportContent {
  summary?: string;
  analysis?: string;
  recommendations?: string[];
  [key: string]: any;
}

interface ReportSummaryCardsProps {
  content: ReportContent;
  reportType: string;
  audience: string;
}

const reportTypeLabels: Record<string, { label: string; icon: typeof BarChart3 }> = {
  health: { label: "Health Report", icon: CheckCircle2 },
  fleet: { label: "Fleet Summary", icon: TrendingUp },
  maintenance: { label: "Maintenance Report", icon: AlertTriangle },
  compliance: { label: "Compliance Report", icon: BarChart3 },
};

export function ReportSummaryCards({ content, reportType, audience }: ReportSummaryCardsProps) {
  const typeInfo = reportTypeLabels[reportType] || reportTypeLabels.health;
  const Icon = typeInfo.icon;
  const recommendationCount = content.recommendations?.length ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="report-summary-cards">
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Icon className="h-4 w-4" />
            <span>Report Type</span>
          </div>
          <p className="font-medium text-sm">{typeInfo.label}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span>Audience</span>
          </div>
          <p className="font-medium text-sm capitalize">{audience}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span>Recommendations</span>
          </div>
          <p className="font-medium text-sm">{recommendationCount} item{recommendationCount !== 1 ? "s" : ""}</p>
        </CardContent>
      </Card>
    </div>
  );
}
