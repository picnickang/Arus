import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmailAlertsSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base" data-testid="text-email-alerts-title">Alert Rules</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground" data-testid="text-email-alerts-desc">
          Manage alert rules and thresholds for equipment monitoring and compliance alerts.
        </p>
      </CardContent>
    </Card>
  );
}
