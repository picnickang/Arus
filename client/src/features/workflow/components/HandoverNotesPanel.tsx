import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clipboard, MessageSquare, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AttentionHandoverSummary, AttentionItem, HandoverRecord } from "../types";

const STORAGE_KEY = "arus.workflow.handover-note";

function summarize(handover: AttentionHandoverSummary, items: AttentionItem[]): string {
  const topLines = handover.suggestedSummary.length
    ? handover.suggestedSummary
    : items.slice(0, 5).map((item) => `${item.title}: ${item.recommendedAction}`);
  return [
    `Open attention items: ${handover.openAttentionItems}`,
    `Critical items: ${handover.criticalItems}`,
    `Blocked jobs: ${handover.blockedJobs}`,
    `Waiting on parts: ${handover.waitingOnParts}`,
    `Ready for closeout: ${handover.readyForCloseout}`,
    ...topLines.map((line) => `- ${line}`),
  ].join("\n");
}

export function HandoverNotesPanel({ handover, items }: { handover: AttentionHandoverSummary; items: AttentionItem[] }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [watchLabel, setWatchLabel] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const generatedSummary = useMemo(() => summarize(handover, items), [handover, items]);

  const { data: latestHandover } = useQuery<HandoverRecord | null>({
    queryKey: ["/api/attention/handover/latest"],
    staleTime: 30_000,
  });

  useEffect(() => {
    if (latestHandover) {
      setNote(latestHandover.note ?? "");
      setWatchLabel(latestHandover.watchLabel ?? "");
      setSavedAt(latestHandover.savedAt ?? null);
      return;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { note?: string; watchLabel?: string; savedAt?: string };
        setNote(parsed.note ?? "");
        setWatchLabel(parsed.watchLabel ?? "");
        setSavedAt(parsed.savedAt ?? null);
      } catch {
        setNote(stored);
      }
    }
  }, [latestHandover]);

  const saveMutation = useMutation({
    mutationFn: (status: HandoverRecord["status"] = "draft") =>
      apiRequest<HandoverRecord>("POST", "/api/attention/handover", {
        note,
        watchLabel: watchLabel || undefined,
        generatedSummary,
        itemIds: items.slice(0, 20).map((item) => item.id),
        status,
      }),
    onSuccess: (record) => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ note, watchLabel, savedAt: record.savedAt }));
      setSavedAt(record.savedAt);
      queryClient.invalidateQueries({ queryKey: ["/api/attention/handover/latest"] });
      const label = record.status === "acknowledged" ? "acknowledged" : record.status === "shared" ? "shared" : "saved";
      toast({ title: `Handover ${label}`, description: "The handover record is saved on the backend and kept locally as a fallback." });
    },
    onError: (error) => {
      const timestamp = new Date().toISOString();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ note, watchLabel, savedAt: timestamp }));
      setSavedAt(timestamp);
      toast({
        title: "Saved locally",
        description: error instanceof Error ? error.message : "Backend handover save failed; local draft was kept.",
        variant: "destructive",
      });
    },
  });

  const copySummary = async () => {
    const text = `${generatedSummary}\n\nWatch/shift: ${watchLabel || "Not specified"}\nStatus: ${latestHandover?.status || "draft"}\n\nHandover note:\n${note || "No extra note."}`;
    await navigator.clipboard?.writeText(text);
    toast({ title: "Briefing copied", description: "The handover briefing is ready to paste into an email, chat, or log note." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Handover note</CardTitle>
        <CardDescription>
          Save the watch-change context to the backend so the next watch can recover it across sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={watchLabel}
          onChange={(event) => setWatchLabel(event.target.value)}
          placeholder="Watch / shift label, for example 0000-0400 engine room"
        />
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add unresolved issues, ETA changes, safety concerns, or next-watch instructions..."
          className="min-h-28"
        />
        {latestHandover?.status && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            Current handover status: <span className="font-medium capitalize">{latestHandover.status}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveMutation.mutate("draft")} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save draft"}
          </Button>
          <Button variant="outline" onClick={() => saveMutation.mutate("shared")} disabled={saveMutation.isPending}>
            <Send className="h-4 w-4" />
            Share handover
          </Button>
          <Button variant="secondary" onClick={() => saveMutation.mutate("acknowledged")} disabled={saveMutation.isPending || latestHandover?.status !== "shared"}>
            <CheckCircle2 className="h-4 w-4" />
            Accept incoming watch
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setNote((current) => `${current}${current ? "\n" : ""}Clarification requested: `);
              toast({ title: "Clarification note started", description: "Add the question, then share the handover again." });
            }}
          >
            <MessageSquare className="h-4 w-4" />
            Ask clarification
          </Button>
          <Button variant="outline" onClick={copySummary}>
            <Clipboard className="h-4 w-4" />
            Copy briefing
          </Button>
        </div>
        {savedAt && <p className="text-xs text-muted-foreground">Last saved {new Date(savedAt).toLocaleString()}.</p>}
      </CardContent>
    </Card>
  );
}
