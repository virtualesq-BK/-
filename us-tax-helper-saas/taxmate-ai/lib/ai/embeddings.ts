import { OpenAIEmbeddings } from '@langchain/openai';
import { langchainOpenAIOptions } from '@/lib/ai/openai-config';

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

let embeddingsInstance: OpenAIEmbeddings | null = null;

export function getEmbeddings(): OpenAIEmbeddings {
  if (!embeddingsInstance) {
    embeddingsInstance = new OpenAIEmbeddings({
      ...langchainOpenAIOptions(),
      modelName: EMBEDDING_MODEL,
    });
  }
  return embeddingsInstance;
}

export async function embedText(text: string): Promise<number[]> {
  return getEmbeddings().embedQuery(text);
}
