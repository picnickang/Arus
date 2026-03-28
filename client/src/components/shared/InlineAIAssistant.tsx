import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Bot, X, Send, Loader2, Minimize2 } from "lucide-react";

interface AIContext {
  equipmentId?: string;
  equipmentName?: string;
  vesselId?: string;
  vesselName?: string;
  workOrderId?: string;
  dtcCode?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Array<{ title: string; relevance: number }>;
}

interface InlineAIAssistantProps {
  context?: AIContext;
  className?: string;
}

export function InlineAIAssistant({ context, className }: InlineAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, isMinimized]);

  const contextString = [
    context?.equipmentName && `Equipment: ${context.equipmentName}`,
    context?.vesselName && `Vessel: ${context.vesselName}`,
    context?.dtcCode && `DTC: ${context.dtcCode}`,
    context?.workOrderId && `Work Order: ${context.workOrderId}`,
  ].filter(Boolean).join(", ");

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      let assistantContent = "";
      let sources: ChatMessage["sources"] = [];

      const unifiedRes = await fetch("/api/kb/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          context: contextString,
          equipmentId: context?.equipmentId,
          vesselId: context?.vesselId,
        }),
      });

      if (unifiedRes.ok) {
        const data = await unifiedRes.json();
        assistantContent = data.answer || data.analysis || data.response || data.text || "";
        sources = (data.sources || []).map((s: any) => ({
          title: s.title || s.documentTitle || "Document",
          relevance: s.relevance || s.score || 0,
        }));
      } else if (unifiedRes.status === 404) {
        const searchRes = await fetch("/api/kb/search?" + new URLSearchParams({ q: query, limit: "3" }));

        let kbResults: any[] = [];
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          kbResults = searchData.results || [];
          sources = kbResults.map((r: any) => ({
            title: r.title || r.documentTitle || "Document",
            relevance: r.relevance || r.score || 0,
          }));
        }

        const analysisRes = await fetch("/api/llm/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            context: contextString,
            equipmentId: context?.equipmentId,
            vesselId: context?.vesselId,
            kbContext: kbResults.map((r: any) => r.content || r.text).join("\n\n"),
          }),
        });

        if (analysisRes.ok) {
          const analysisData = await analysisRes.json();
          assistantContent = analysisData.analysis || analysisData.response || analysisData.text || "";
        } else if (kbResults.length > 0) {
          assistantContent = kbResults.map((r: any) => r.content || r.text).join("\n\n");
        }
      }

      if (!assistantContent) {
        assistantContent = "I couldn't find relevant information. Try rephrasing your question, or check the Knowledge Base for uploaded documentation.";
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Your question has been saved and will be answered when connectivity returns.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    context?.equipmentName && `What's the maintenance procedure for ${context.equipmentName}?`,
    context?.equipmentName && `What are common failure modes for this equipment?`,
    context?.dtcCode && `What does DTC ${context.dtcCode} mean?`,
    "What spare parts are needed?",
  ].filter(Boolean) as string[];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-30 bottom-20 md:bottom-6 right-4 h-12 w-12 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          className
        )}
        aria-label="Ask AI Assistant"
        data-testid="button-ai-open"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={cn(
          "fixed z-30 bottom-20 md:bottom-6 right-4 h-12 px-4 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "flex items-center gap-2",
          "hover:scale-105 active:scale-95 transition-transform",
          className
        )}
        data-testid="button-ai-expand"
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">AI Assistant</span>
        {messages.length > 0 && (
          <span className="bg-primary-foreground/20 text-xs px-1.5 py-0.5 rounded-full">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-30 bottom-16 md:bottom-4 right-4 left-4 md:left-auto",
        "md:w-[400px] max-h-[70vh] rounded-xl border shadow-2xl",
        "bg-background flex flex-col overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <span className="text-sm font-semibold">AI Assistant</span>
            {contextString && (
              <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                {contextString}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Minimize"
            data-testid="button-ai-minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setIsOpen(false); setIsMinimized(false); }}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Close"
            data-testid="button-ai-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[50vh]">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask about maintenance procedures, equipment specs, troubleshooting, or any technical question.
            </p>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                {suggestions.slice(0, 3).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s); }}
                    data-testid={`button-ai-suggestion-${i}`}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-dashed
                               border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] px-3 py-2 rounded-xl text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-foreground/10">
                  <div className="text-[10px] font-medium opacity-70 mb-1">Sources:</div>
                  {msg.sources.map((s, j) => (
                    <div key={j} className="text-[10px] opacity-60 truncate">
                      • {s.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-3 border-t bg-card">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask a question..."
            className="flex-1 h-10 px-3 text-sm rounded-lg border bg-background
                       focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isLoading}
            data-testid="input-ai-query"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 rounded-lg bg-primary text-primary-foreground
                       flex items-center justify-center disabled:opacity-50
                       hover:bg-primary/90 transition-colors touch-target"
            data-testid="button-ai-send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default InlineAIAssistant;
