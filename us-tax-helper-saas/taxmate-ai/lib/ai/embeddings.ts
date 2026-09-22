import { OpenAIEmbeddings } from '@langchain/openai';

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

let embeddingsInstance: OpenAIEmbeddings | null = null;

export function getEmbeddings(): OpenAIEmbeddings {
  if (!embeddingsInstance) {
    embeddingsInstance = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: EMBEDDING_MODEL,
    });
  }
  return embeddingsInstance;
}

export async function embedText(text: string): Promise<number[]> {
  return getEmbeddings().embedQuery(text);
}
