import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, TrendingUp } from "lucide-react";

export function TrendsTab({ o }: { o: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Enhanced Trend Analytics
        </CardTitle>
        <CardDescription>
          Advanced statistical analysis and forecasting insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        {o.trendsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p data-testid="text-trends-coming-soon">
              Enhanced trend insights integration coming soon
            </p>
            <p className="text-sm mt-2">Connect with existing enhanced-trends service</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
