import { Card, CardContent } from "@/components/ui/card";
import { FileText, ShieldCheck, Clock, ShieldAlert } from "lucide-react";

export interface CertSummary {
  total: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  suspended: number;
  pendingRenewal: number;
}

export function SummaryCards({ summary }: { summary?: CertSummary | undefined }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-1">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold" data-testid="text-summary-total">
                {summary?.total ?? 0}
              </p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-1">
            <div>
              <p className="text-sm text-muted-foreground">Valid</p>
              <p className="text-2xl font-bold text-green-600" data-testid="text-summary-valid">
                {summary?.valid ?? 0}
              </p>
            </div>
            <ShieldCheck className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-1">
            <div>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
              <p className="text-2xl font-bold text-amber-600" data-testid="text-summary-expiring">
                {summary?.expiringSoon ?? 0}
              </p>
            </div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-1">
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-red-600" data-testid="text-summary-expired">
                {summary?.expired ?? 0}
              </p>
            </div>
            <ShieldAlert className="h-8 w-8 text-red-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
