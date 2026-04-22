import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmailTemplatesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base" data-testid="text-email-templates-title">
          Email Templates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground" data-testid="text-email-templates-desc">
          Customize email notification templates for different alert types and reports.
        </p>
      </CardContent>
    </Card>
  );
}
