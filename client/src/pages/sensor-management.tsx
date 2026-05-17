import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SensorManagement() {
  return (
    <Card data-testid="card-sensor-management-placeholder">
      <CardHeader>
        <CardTitle>Sensor Management</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Sensor management has moved to the Equipment Hierarchy module.
        </p>
      </CardContent>
    </Card>
  );
}
