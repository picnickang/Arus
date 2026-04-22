import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { AgentChatPanel } from "./AgentChatPanel";

interface DraftSummary {
  id: string;
  status: string;
}

export function CopilotFab() {
  const [open, setOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);

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
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-12 w-12 rounded-full shadow-lg"
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
      <AgentChatPanel open={open} onClose={handleClose} initialMessage={initialMessage} />
    </>
  );
}

export function useCopilotOpen() {
  const [state, setState] = useState<{ open: boolean; message: string | null }>({
    open: false,
    message: null,
  });

  const openChat = useCallback((msg?: string) => {
    setState({ open: true, message: msg || null });
  }, []);

  const closeChat = useCallback(() => {
    setState({ open: false, message: null });
  }, []);

  return { ...state, openChat, closeChat };
}
