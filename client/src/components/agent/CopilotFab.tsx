import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { AgentChatPanel } from "./AgentChatPanel";

export function CopilotFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-12 w-12 rounded-full shadow-lg"
        data-testid="button-copilot-fab"
      >
        <Bot className="h-5 w-5" />
      </Button>
      <AgentChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
