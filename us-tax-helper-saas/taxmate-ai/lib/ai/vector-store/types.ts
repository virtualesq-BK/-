import type { Document } from '@langchain/core/documents';

export type VectorStoreProvider = 'pinecone' | 'local';

export interface StoredChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    source: string;
    sourceName: string;
    chunkIndex: number;
  };
}

export interface IrsVectorStore {
  addDocuments(docs: Document[]): Promise<void>;
  similaritySearch(query: string, k?: number): Promise<Document[]>;
}
