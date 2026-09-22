import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import type { Document } from '@langchain/core/documents';
import { getEmbeddings } from '@/lib/ai/embeddings';
import type { IrsVectorStore } from './types';

let pineconeIndex: ReturnType<Pinecone['index']> | null = null;

function getPineconeIndex() {
  if (!pineconeIndex) {
    const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    pineconeIndex = client.index(process.env.PINECONE_INDEX ?? 'taxmate-irs-docs');
  }
  return pineconeIndex;
}

async function getLangchainStore(): Promise<PineconeStore> {
  return PineconeStore.fromExistingIndex(getEmbeddings(), {
    pineconeIndex: getPineconeIndex(),
    namespace: process.env.PINECONE_NAMESPACE ?? 'irs-publications',
  });
}

export class PineconeIrsVectorStore implements IrsVectorStore {
  async addDocuments(docs: Document[]): Promise<void> {
    const store = await getLangchainStore();
    await store.addDocuments(docs);
    console.log(`[pinecone] Upserted ${docs.length} chunks`);
  }

  async similaritySearch(query: string, k = 5): Promise<Document[]> {
    const store = await getLangchainStore();
    return store.similaritySearch(query, k);
  }
}
