import type { VectorStoreProvider, IrsVectorStore } from './types';
import { LocalIrsVectorStore } from './local';
import { PineconeIrsVectorStore } from './pinecone';

export function getVectorStoreProvider(): VectorStoreProvider {
  const configured = process.env.VECTOR_STORE as VectorStoreProvider | undefined;
  if (configured === 'local' || configured === 'pinecone') return configured;
  return process.env.PINECONE_API_KEY ? 'pinecone' : 'local';
}

export function getIrsVectorStore(): IrsVectorStore {
  const provider = getVectorStoreProvider();
  if (provider === 'pinecone') {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required when VECTOR_STORE=pinecone');
    }
    return new PineconeIrsVectorStore();
  }
  return new LocalIrsVectorStore();
}

export type { IrsVectorStore, VectorStoreProvider };
