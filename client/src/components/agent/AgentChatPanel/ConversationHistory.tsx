import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "./types";

export function ConversationHistory({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {conversations.length === 0 && (
          <p
            className="text-sm text-muted-foreground text-center py-8"
            data-testid="text-no-conversations"
          >
            No conversations yet
          </p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            className={cn(
              "w-full text-left p-3 rounded-md hover:bg-muted transition-colors",
              selectedId === conv.id && "bg-accent"
            )}
            onClick={() => onSelect(conv.id)}
            data-testid={`button-conversation-${conv.id}`}
          >
            <p className="text-sm font-medium truncate">{conv.title || "Untitled"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {conv.messageCount} messages · {new Date(conv.updatedAt).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
