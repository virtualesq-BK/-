import { streamText } from 'ai';
import { getServerSession } from 'next-auth';
import { MessageRole } from '@prisma/client';
import { openai } from '@/lib/ai/openai';
import {
  buildAugmentedSystemPrompt,
  retrieveIrsContext,
} from '@/lib/ai/rag';
import { appendChatMessages } from '@/lib/ai/chat-history';
import {
  getOrCreateCurrentTaxReturn,
  persistAuditRiskScore,
} from '@/lib/ai/auditRiskScore';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const messages: ChatMessage[] = body.messages ?? [];
  const sessionId: string | undefined = body.sessionId;
  const taxReturnId: string | undefined = body.taxReturnId;
  const attachedContext: string | undefined = body.attachedContext;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return new Response(JSON.stringify({ error: 'No user message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = session.user.id;
  const query = lastUserMessage.content;

  const { context: irsContext } = await retrieveIrsContext(query, 5);
  const systemPrompt = buildAugmentedSystemPrompt(
    attachedContext
      ? `${irsContext}\n\n## User-Attached Document Context\n${attachedContext}`
      : irsContext
  );

  const result = streamText({
    model: openai(process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o'),
    system: systemPrompt,
    messages,
    temperature: 0.2,
    onFinish: async ({ text }) => {
      try {
        await appendChatMessages(
          userId,
          [
            { role: 'user', content: query },
            { role: 'assistant', content: text },
          ],
          sessionId
        );

        const taxReturn =
          taxReturnId != null
            ? await prisma.taxReturn.findFirst({
                where: { id: taxReturnId, userId, deletedAt: null },
              })
            : await getOrCreateCurrentTaxReturn(userId);

        if (taxReturn) {
          await prisma.message.createMany({
            data: [
              {
                userId,
                taxReturnId: taxReturn.id,
                role: MessageRole.USER,
                content: query,
                metadata: { sessionId, hasAttachment: Boolean(attachedContext) },
              },
              {
                userId,
                taxReturnId: taxReturn.id,
                role: MessageRole.AI,
                content: text,
                metadata: { sessionId, rag: true },
              },
            ],
          });

          await persistAuditRiskScore({
            userId,
            taxReturnId: taxReturn.id,
            userMessage: query,
            assistantMessage: text,
          });
        }
      } catch (err) {
        console.error('[chat] post-processing error:', err);
      }
    },
  });

  return result.toDataStreamResponse();
}
