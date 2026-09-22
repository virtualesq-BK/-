import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import OpenAI from 'openai';
import { authOptions } from '@/lib/auth/auth-options';
import { openAIClientOptions } from '@/lib/ai/openai-config';

export const runtime = 'nodejs';

const openaiClient = new OpenAI(openAIClientOptions());

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  const formData = await req.formData();
  const audio = formData.get('audio');

  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  const file = new File([audio], 'recording.webm', { type: audio.type || 'audio/webm' });

  const transcription = await openaiClient.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_WHISPER_MODEL ?? 'whisper-1',
    language: formData.get('language')?.toString() ?? undefined,
  });

  return NextResponse.json({ text: transcription.text });
}
