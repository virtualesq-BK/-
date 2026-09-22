import { redis } from '@/lib/db/redis';

const CHAT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

const memoryFallback = new Map<string, ChatHistoryMessage[]>();

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

export type ChatHistoryMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
};

function chatKey(userId: string, sessionId?: string): string {
  return sessionId ? `chat:${userId}:${sessionId}` : `chat:${userId}`;
}

export async function getChatHistory(
  userId: string,
  sessionId?: string
): Promise<ChatHistoryMessage[]> {
  const key = chatKey(userId, sessionId);
  if (!isRedisConfigured()) {
    return memoryFallback.get(key) ?? [];
  }
  const data = await redis.get<ChatHistoryMessage[]>(key);
  return data ?? [];
}

export async function saveChatHistory(
  userId: string,
  messages: ChatHistoryMessage[],
  sessionId?: string
): Promise<void> {
  const key = chatKey(userId, sessionId);
  if (!isRedisConfigured()) {
    memoryFallback.set(key, messages);
    return;
  }
  await redis.set(key, messages, { ex: CHAT_TTL_SECONDS });
}

export async function appendChatMessages(
  userId: string,
  newMessages: ChatHistoryMessage[],
  sessionId?: string
): Promise<ChatHistoryMessage[]> {
  const existing = await getChatHistory(userId, sessionId);
  const updated = [
    ...existing,
    ...newMessages.map((m) => ({
      ...m,
      createdAt: m.createdAt ?? new Date().toISOString(),
    })),
  ];
  await saveChatHistory(userId, updated, sessionId);
  return updated;
}
