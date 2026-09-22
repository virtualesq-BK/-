import { BaseRetriever } from '@langchain/core/retrievers';
import type { Document } from '@langchain/core/documents';
import { ChatOpenAI } from '@langchain/openai';
import { RetrievalQAChain } from 'langchain/chains';
import { getIrsVectorStore } from '@/lib/ai/vector-store';
import { getRagSystemPrompt } from '@/lib/ai/prompts';

class IrsPublicationRetriever extends BaseRetriever {
  lc_namespace = ['taxmate', 'irs_retriever'];

  constructor(private topK = 5) {
    super();
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const store = getIrsVectorStore();
    return store.similaritySearch(query, this.topK);
  }
}

export function formatDocsAsContext(docs: Document[]): string {
  if (docs.length === 0) {
    return 'No IRS publication context was retrieved. Answer conservatively and recommend CPA consultation.';
  }

  return docs
    .map(
      (doc, i) =>
        `[Source ${i + 1}: ${doc.metadata.sourceName ?? doc.metadata.source}]\n${doc.pageContent}`
    )
    .join('\n\n---\n\n');
}

export async function retrieveIrsContext(query: string, k = 5): Promise<{
  docs: Document[];
  context: string;
}> {
  const store = getIrsVectorStore();
  const docs = await store.similaritySearch(query, k);
  return { docs, context: formatDocsAsContext(docs) };
}

/**
 * LangChain RetrievalQAChain — RAG 답변 생성 (비스트리밍 / 감사 점수용)
 */
export async function runRetrievalQA(query: string): Promise<{
  answer: string;
  sourceDocuments: Document[];
}> {
  const llm = new ChatOpenAI({
    modelName: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
    temperature: 0.2,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const retriever = new IrsPublicationRetriever(5);
  const chain = RetrievalQAChain.fromLLM(llm, retriever, {
    returnSourceDocuments: true,
    verbose: process.env.NODE_ENV === 'development',
  });

  const result = await chain.invoke({ query });

  return {
    answer: String(result.text ?? ''),
    sourceDocuments: (result.sourceDocuments as Document[]) ?? [],
  };
}

export function buildAugmentedSystemPrompt(irsContext: string): string {
  return `${getRagSystemPrompt()}

## IRS Publication Context (retrieved)
${irsContext}`;
}
