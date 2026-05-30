import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShieldCheck } from "lucide-react";

interface SafetyBulletin {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  category: string;
  reference: string | null;
  effectiveDate: string | null;
  expiresAt: string | null;
  createdAt: string | null;
}

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  critical: "destructive",
  warning: "default",
  advisory: "secondary",
  info: "outline",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SafetyBulletinsPage() {
  const { data, isLoading } = useQuery<SafetyBulletin[]>({
    queryKey: ["/api/safety-bulletins"],
    refetchInterval: 60000,
  });

  const bulletins = Array.isArray(data) ? data : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/home">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1
          className="flex items-center gap-2 text-lg font-semibold"
          data-testid="text-page-title"
        >
          <ShieldCheck className="h-5 w-5 text-primary" /> Safety Notices
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-3" data-testid="loading-safety-bulletins">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : bulletins.length === 0 ? (
        <Card data-testid="empty-safety-bulletins">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No safety notices at this time.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bulletins.map((b) => (
            <Card key={b.id} data-testid={`card-safety-bulletin-${b.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base" data-testid={`text-title-${b.id}`}>
                    {b.title}
                  </CardTitle>
                  <Badge
                    variant={SEVERITY_VARIANT[b.severity] ?? "outline"}
                    data-testid={`badge-severity-${b.id}`}
                  >
                    {b.severity}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {[formatDate(b.effectiveDate), b.reference]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </CardHeader>
              {b.body && (
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {b.body}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
