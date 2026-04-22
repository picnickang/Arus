import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, BarChart3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResponsiveContainer, ReferenceArea } from "recharts";
import { ReactElement, cloneElement, Children, isValidElement } from "react";

export interface ThresholdBand {
  min: number;
  max: number;
  label?: string;
}

interface ChartWrapperProps {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  "data-testid"?: string;
  optimalRange?: ThresholdBand;
  criticalRange?: ThresholdBand;
  warningRange?: ThresholdBand;
  showBands?: boolean;
}

export function ChartWrapper({
  title,
  description,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage = "No data available for this time period",
  children,
  className,
  actions,
  "data-testid": testId,
  optimalRange,
  criticalRange,
  warningRange,
  showBands = false,
}: ChartWrapperProps) {
  const enhancedChildren =
    showBands && (optimalRange || criticalRange || warningRange)
      ? Children.map(children, (child) => {
          if (!isValidElement(child)) {
            return child;
          }

          const bandElements = [];

          if (optimalRange) {
            bandElements.push(
              <ReferenceArea
                key="optimal-band"
                y1={optimalRange.min}
                y2={optimalRange.max}
                fill="hsl(142, 76%, 36%)"
                fillOpacity={0.1}
                label={optimalRange.label}
                ifOverflow="extendDomain"
              />
            );
          }

          if (warningRange) {
            bandElements.push(
              <ReferenceArea
                key="warning-band"
                y1={warningRange.min}
                y2={warningRange.max}
                fill="hsl(38, 92%, 50%)"
                fillOpacity={0.1}
                label={warningRange.label}
                ifOverflow="extendDomain"
              />
            );
          }

          if (criticalRange) {
            bandElements.push(
              <ReferenceArea
                key="critical-band"
                y1={criticalRange.min}
                y2={criticalRange.max}
                fill="hsl(0, 84%, 60%)"
                fillOpacity={0.1}
                label={criticalRange.label}
                ifOverflow="extendDomain"
              />
            );
          }

          return cloneElement(child as ReactElement, {
            children: [
              ...bandElements,
              ...(Array.isArray((child as ReactElement).props.children)
                ? (child as ReactElement).props.children
                : [(child as ReactElement).props.children]),
            ].filter(Boolean),
          });
        })
      : children;

  return (
    <Card className={className} data-testid={testId}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid={`${testId}-loading`}>
            <Skeleton className="h-[300px] w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : error ? (
          <Alert variant="destructive" data-testid={`${testId}-error`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isEmpty ? (
          <div
            className="flex flex-col items-center justify-center h-[300px] text-muted-foreground"
            data-testid={`${testId}-empty`}
          >
            <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {enhancedChildren}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
