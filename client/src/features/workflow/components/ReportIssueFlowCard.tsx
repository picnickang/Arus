import { Camera, ClipboardCheck, ListChecks } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportIssueFlowCard() {
  const [, setLocation] = useLocation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          Guided issue flow
        </CardTitle>
        <CardDescription>
          Turn a finding into a work order, log note, or handover item without hunting through modules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <div className="rounded-lg border p-3">1. Classify severity and vessel/equipment.</div>
          <div className="rounded-lg border p-3">2. Attach photo/evidence and location.</div>
          <div className="rounded-lg border p-3">3. Assign owner, due date, and parts check.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setLocation("/work-orders?action=create&flow=report-issue")}>
            <ClipboardCheck className="h-4 w-4" />
            Create issue work order
          </Button>
          <Button variant="outline" onClick={() => setLocation("/findings?action=create&flow=report-issue")}>
            <Camera className="h-4 w-4" />
            Record finding
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
