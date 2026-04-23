import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUGGESTED_PROMPTS } from "./constants";

export function EmptyState({ onSelectPrompt }: { onSelectPrompt: (prompt: string) => void }) {
  return (
    <div className="text-center py-12 space-y-3" data-testid="card-empty-state">
      <Bot className="h-12 w-12 mx-auto text-muted-foreground/40" />
      <div>
        <p className="font-medium text-sm" data-testid="text-welcome">
          ARUS Copilot
        </p>
        <p
          className="text-xs text-muted-foreground mt-1"
          data-testid="text-welcome-description"
        >
          Ask about equipment, maintenance, alerts, or request work orders
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {SUGGESTED_PROMPTS.map((q) => (
          <Button
            key={q}
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onSelectPrompt(q)}
            data-testid={`button-suggestion-${q.replace(/\s+/g, "-").toLowerCase()}`}
          >
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
}
