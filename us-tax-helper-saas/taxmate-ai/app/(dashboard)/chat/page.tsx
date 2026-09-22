import { ChatInterface } from '@/components/chat/ChatInterface';

export default function ChatPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Tax Assistant</h1>
        <p className="text-muted-foreground">
          Ask questions about deductions, forms, and your filing status
        </p>
      </div>
      <ChatInterface />
    </div>
  );
}
