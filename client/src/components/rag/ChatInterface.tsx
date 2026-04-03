import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Bot, User, ThumbsUp, ThumbsDown, FileText, RefreshCw, Plus } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  sourceChunkIds?: string[];
  createdAt: string;
}

interface Citation {
  chunkId: string;
  documentTitle: string;
  relevanceScore: number;
  excerpt?: string;
}

interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface RagAskResponse {
  answer: string;
  conversationId: string;
  messageId: string;
  citations: Citation[];
  sourceChunkIds: string[];
  cached: boolean;
  model: string;
}

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: conversations, isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ['/api/rag/conversations'],
  });

  const { data: conversationDetail, isLoading: loadingMessages } = useQuery<{
    conversation: Conversation;
    messages: Message[];
  }>({
    queryKey: ['/api/rag/conversations', activeConversationId],
    enabled: !!activeConversationId,
  });

  const messages = conversationDetail?.messages || [];

  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest('POST', '/api/rag/conversations', { title });
    },
    onSuccess: (data) => {
      setActiveConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/rag/conversations'] });
    },
  });

  const askMutation = useMutation({
    mutationFn: async ({ query, conversationId }: { query: string; conversationId?: string | null }) => {
      return apiRequest('POST', '/api/rag/ask', {
        query,
        conversationId: conversationId ?? activeConversationId ?? undefined,
      }) as Promise<RagAskResponse>;
    },
    onSuccess: (data) => {
      const convId = data.conversationId || activeConversationId;
      if (!activeConversationId && data.conversationId) {
        setActiveConversationId(data.conversationId);
      }
      if (convId) {
        queryClient.invalidateQueries({ queryKey: ['/api/rag/conversations', convId] });
      }
      if (activeConversationId && activeConversationId !== convId) {
        queryClient.invalidateQueries({ queryKey: ['/api/rag/conversations', activeConversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/rag/conversations'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to get response',
        variant: 'destructive',
      });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (params: { messageId: string; feedbackType: 'helpful' | 'not_helpful' }) => {
      await apiRequest('POST', '/api/rag/feedback', params);
    },
    onSuccess: () => {
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for your feedback',
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || askMutation.isPending) return;

    const query = input.trim();
    setInput('');

    if (!activeConversationId) {
      const conversation = await createConversationMutation.mutateAsync(query.slice(0, 50));
      const askResult = await askMutation.mutateAsync({ query, conversationId: conversation.id });
      const convId = askResult.conversationId || conversation.id;
      setActiveConversationId(convId);
      await queryClient.refetchQueries({ queryKey: ['/api/rag/conversations', convId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/rag/conversations'] });
    } else {
      await askMutation.mutateAsync({ query });
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setInput('');
  };

  const handleFeedback = (messageId: string, feedbackType: 'helpful' | 'not_helpful') => {
    feedbackMutation.mutate({ messageId, feedbackType });
  };

  return (
    <div className="flex h-full gap-4">
      <Card className="w-64 flex-shrink-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Conversations</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleNewConversation}
              data-testid="button-new-conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[calc(100vh-300px)]">
            {loadingConversations ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {conversations?.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={cn(
                      'w-full text-left p-2 rounded-md text-sm transition-colors hover-elevate',
                      activeConversationId === conv.id
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    )}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <p className="font-medium truncate">{conv.title || 'New conversation'}</p>
                    <p className="text-xs text-muted-foreground">
                      {conv.messageCount} messages
                    </p>
                  </button>
                ))}
                {conversations?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-conversations">
                    No conversations yet
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Knowledge Base Assistant
            </CardTitle>
            {activeConversationId && (
              <Badge variant="secondary" data-testid="badge-conversation-title">
                {conversationDetail?.conversation?.title || 'Loading...'}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {loadingMessages && activeConversationId ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8" data-testid="empty-state-messages">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg" data-testid="text-welcome-title">How can I help you?</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2" data-testid="text-welcome-description">
                  Ask questions about your marine equipment, maintenance procedures,
                  or any documents in your knowledge base.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onFeedback={handleFeedback}
                    isPending={false}
                  />
                ))}
                {askMutation.isPending && (
                  <MessageBubble
                    message={{
                      id: 'pending',
                      role: 'assistant',
                      content: '',
                      createdAt: new Date().toISOString(),
                    }}
                    isPending={true}
                    onFeedback={() => {}}
                  />
                )}
              </div>
            )}
          </ScrollArea>

          <form
            onSubmit={handleSubmit}
            className="p-4 border-t flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your knowledge base..."
              disabled={askMutation.isPending}
              data-testid="input-rag-query"
            />
            <Button
              type="submit"
              disabled={!input.trim() || askMutation.isPending}
              data-testid="button-send-query"
            >
              {askMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isPending: boolean;
  onFeedback: (messageId: string, type: 'helpful' | 'not_helpful') => void;
}

function MessageBubble({ message, isPending, onFeedback }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
      data-testid={`message-${message.id}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          'max-w-[80%] rounded-lg p-3',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {isPending ? (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-content-${message.id}`}>{message.content}</p>
            
            {!isUser && message.citations && message.citations.length > 0 && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <p className="text-xs font-medium mb-1">Sources:</p>
                <div className="flex flex-wrap gap-1">
                  {message.citations.map((citation, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-xs"
                      data-testid={`badge-citation-${message.id}-${idx}`}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      {citation.documentTitle || `Source ${idx + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {!isUser && message.id !== 'pending' && (
              <div className="mt-2 flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => onFeedback(message.id, 'helpful')}
                  data-testid={`feedback-helpful-${message.id}`}
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => onFeedback(message.id, 'not_helpful')}
                  data-testid={`feedback-not-helpful-${message.id}`}
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
