import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SensorManagement() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/equipment");
  }, [setLocation]);

  return (
    <Card data-testid="card-sensor-management-redirect">
      <CardHeader>
        <CardTitle>Opening Equipment Hierarchy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sensor configuration is managed from the Equipment Hierarchy module.
        </p>
        <Button asChild variant="outline" data-testid="link-sensor-management-equipment">
          <Link href="/equipment">Open Equipment Hierarchy</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
