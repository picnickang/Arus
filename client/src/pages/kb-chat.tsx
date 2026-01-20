import { PageHeader } from '@/components/navigation';
import { ChatInterface } from '@/components/rag';

export default function KnowledgeBaseChatPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader title="Knowledge Base Assistant" />
      <div className="flex-1 p-6">
        <ChatInterface />
      </div>
    </div>
  );
}
