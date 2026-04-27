import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, ClipboardCheck, ListChecks, Save } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { IssueReportRecord } from "../types";

export function ReportIssueFlowCard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<IssueReportRecord["severity"]>("medium");
  const [target, setTarget] = useState<IssueReportRecord["target"]>("work_order");
  const [vessel, setVessel] = useState("");
  const [equipment, setEquipment] = useState("");
  const [location, setIssueLocation] = useState("");
  const [impact, setImpact] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [createdIssue, setCreatedIssue] = useState<IssueReportRecord | null>(null);

  const reportMutation = useMutation({
    mutationFn: () =>
      apiRequest<IssueReportRecord>("POST", "/api/attention/issues", {
        severity,
        summary,
        vessel: vessel || undefined,
        equipment: equipment || undefined,
        location: location || undefined,
        impact: impact || undefined,
        evidenceNote: evidenceNote || undefined,
        owner: owner || undefined,
        dueDate: dueDate || undefined,
        target,
        status: "draft",
      }),
    onSuccess: (record) => {
      setCreatedIssue(record);
      toast({ title: "Issue draft saved", description: "Open the suggested workflow to turn it into a work order, finding, log note, or handover item." });
    },
    onError: (error) => {
      toast({
        title: "Issue could not be saved",
        description: error instanceof Error ? error.message : "The workflow issue report was rejected.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          Guided issue flow
        </CardTitle>
        <CardDescription>
          Capture a field issue once, then open the right downstream workflow with context preserved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <div className="rounded-lg border p-3">1. Classify severity and vessel/equipment.</div>
          <div className="rounded-lg border p-3">2. Capture impact, evidence, and location.</div>
          <div className="rounded-lg border p-3">3. Route to work order, finding, log note, or handover.</div>
        </div>

        {!expanded ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setExpanded(true)}>
              <ClipboardCheck className="h-4 w-4" />
              Report issue
            </Button>
            <Button variant="outline" onClick={() => setLocation("/findings?action=create&flow=report-issue") }>
              <Camera className="h-4 w-4" />
              Quick finding
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border p-3">
            <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Issue summary" />
            <div className="grid gap-3 md:grid-cols-4">
              <Select value={severity} onValueChange={(value) => setSeverity(value as IssueReportRecord["severity"])}>
                <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={target} onValueChange={(value) => setTarget(value as IssueReportRecord["target"])}>
                <SelectTrigger><SelectValue placeholder="Route to" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="work_order">Work order</SelectItem>
                  <SelectItem value="finding">Finding</SelectItem>
                  <SelectItem value="log_note">Log note</SelectItem>
                  <SelectItem value="handover">Handover</SelectItem>
                </SelectContent>
              </Select>
              <Input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Owner" />
              <Input value={dueDate} onChange={(event) => setDueDate(event.target.value)} placeholder="Due / ETA" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Input value={vessel} onChange={(event) => setVessel(event.target.value)} placeholder="Vessel" />
              <Input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="Equipment" />
              <Input value={location} onChange={(event) => setIssueLocation(event.target.value)} placeholder="Location" />
            </div>
            <Textarea value={impact} onChange={(event) => setImpact(event.target.value)} placeholder="Safety, compliance, reliability, or operational impact..." />
            <Textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Evidence note, photo reference, reading, log entry, or inspection detail..." />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => reportMutation.mutate()} disabled={!summary.trim() || reportMutation.isPending}>
                <Save className="h-4 w-4" />
                {reportMutation.isPending ? "Saving..." : "Save issue draft"}
              </Button>
              {createdIssue && (
                <Button variant="outline" onClick={() => setLocation(createdIssue.suggestedHref)}>
                  Open suggested workflow
                </Button>
              )}
              <Button variant="ghost" onClick={() => setExpanded(false)}>Collapse</Button>
            </div>
            {createdIssue && (
              <p className="text-xs text-muted-foreground">
                Saved issue {createdIssue.id.slice(0, 8)} as {createdIssue.target.replace(/_/g, " ")} draft.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
