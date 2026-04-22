import { Suspense, lazy } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const FinanceMode = lazy(() =>
  import("@/components/analytics/FinanceMode").then((m) => ({ default: m.FinanceMode }))
);

export default function AnalyticsFinancePage() {
  return (
    <div className="min-h-screen" data-testid="analytics-finance-page">
      <div className="px-6 py-4 border-b flex items-center gap-3">
        <Link href="/analytics">
          <Button variant="ghost" size="sm" data-testid="button-back-analytics">
            <ArrowLeft className="h-4 w-4 mr-1" /> Analytics
          </Button>
        </Link>
        <h1 className="text-lg font-bold">Finance Analytics</h1>
      </div>
      <div className="p-4 lg:p-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          }
        >
          <FinanceMode />
        </Suspense>
      </div>
    </div>
  );
}
