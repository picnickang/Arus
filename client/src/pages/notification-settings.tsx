import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotificationSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base" data-testid="text-notification-settings-title">Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground" data-testid="text-notification-settings-desc">
          Configure notification channels and delivery preferences. Settings for email, push, and in-app notifications.
        </p>
      </CardContent>
    </Card>
  );
}
