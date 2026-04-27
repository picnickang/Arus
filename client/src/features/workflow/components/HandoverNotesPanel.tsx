import { useEffect, useMemo, useState } from "react";
import { Clipboard, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AttentionHandoverSummary, AttentionItem } from "../types";

const STORAGE_KEY = "arus.workflow.handover-note";

export function HandoverNotesPanel({ handover, items }: { handover: AttentionHandoverSummary; items: AttentionItem[] }) {
  const [note, setNote] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { note?: string; savedAt?: string };
        setNote(parsed.note ?? "");
        setSavedAt(parsed.savedAt ?? null);
      } catch {
        setNote(stored);
      }
    }
  }, []);

  const generatedSummary = useMemo(() => {
    const topLines = handover.suggestedSummary.length
      ? handover.suggestedSummary
      : items.slice(0, 5).map((item) => `${item.title}: ${item.recommendedAction}`);
    return [
      `Open attention items: ${handover.openAttentionItems}`,
      `Critical items: ${handover.criticalItems}`,
      `Blocked jobs: ${handover.blockedJobs}`,
      `Ready for closeout: ${handover.readyForCloseout}`,
      ...topLines.map((line) => `- ${line}`),
    ].join("\n");
  }, [handover, items]);

  const saveNote = () => {
    const timestamp = new Date().toISOString();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ note, savedAt: timestamp }));
    setSavedAt(timestamp);
  };

  const copySummary = async () => {
    const text = `${generatedSummary}\n\nHandover note:\n${note || "No extra note."}`;
    await navigator.clipboard?.writeText(text);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Handover note</CardTitle>
        <CardDescription>
          Capture the watch-change context. This is stored locally until a backend handover record is added.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add unresolved issues, ETA changes, safety concerns, or next-watch instructions..."
          className="min-h-28"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveNote}>
            <Save className="h-4 w-4" />
            Save handover draft
          </Button>
          <Button variant="outline" onClick={copySummary}>
            <Clipboard className="h-4 w-4" />
            Copy briefing
          </Button>
        </div>
        {savedAt && <p className="text-xs text-muted-foreground">Draft saved {new Date(savedAt).toLocaleString()}.</p>}
      </CardContent>
    </Card>
  );
}
