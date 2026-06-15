import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";

// The chat panel (markdown/streaming UI) is the heavy part of this widget and is
// not needed until the user opens the Copilot, so it is code-split out of the
// entry chunk and loaded on first open.
const AgentChatPanel = lazy(() =>
  import("./AgentChatPanel").then((m) => ({ default: m.AgentChatPanel }))
);

interface DraftSummary {
  id: string;
  status: string;
}

export function CopilotFab() {
  const [open, setOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  // Mount the lazy chat panel on first open, then keep it mounted so chat state
  // and the close animation are preserved across subsequent open/close.
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (open) {
      setEverOpened(true);
    }
  }, [open]);

  const { data: drafts } = useQuery<DraftSummary[]>({
    queryKey: ["/api/agent/drafts"],
    refetchInterval: 30000,
  });

  const pendingCount = (drafts || []).filter((d) => d.status === "pending").length;

  const openWithMessage = useCallback((msg: string) => {
    setInitialMessage(msg);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setInitialMessage(null);
  }, []);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 h-12 w-12 rounded-full shadow-lg"
        data-testid="button-copilot-fab"
      >
        <Bot className="h-5 w-5" />
        {pendingCount > 0 && (
          <span
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium"
            data-testid="badge-fab-pending"
          >
            {pendingCount}
          </span>
        )}
      </Button>
      {everOpened && (
        <Suspense fallback={null}>
          <AgentChatPanel open={open} onClose={handleClose} initialMessage={initialMessage} />
        </Suspense>
      )}
    </>
  );
}
