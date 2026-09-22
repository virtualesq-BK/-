import fs from 'fs/promises';
import path from 'path';
import type { Document } from '@langchain/core/documents';
import { getEmbeddings } from '@/lib/ai/embeddings';
import type { IrsVectorStore, StoredChunk } from './types';

const STORE_PATH = path.join(process.cwd(), 'data', 'irs-vector-store.json');

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function loadChunks(): Promise<StoredChunk[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as StoredChunk[];
  } catch {
    return [];
  }
}

async function saveChunks(chunks: StoredChunk[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(chunks, null, 2), 'utf-8');
}

export class LocalIrsVectorStore implements IrsVectorStore {
  async addDocuments(docs: Document[]): Promise<void> {
    const existing = await loadChunks();
    const embeddings = getEmbeddings();
    const vectors = await embeddings.embedDocuments(docs.map((d) => d.pageContent));

    const newChunks: StoredChunk[] = docs.map((doc, i) => ({
      id: `${doc.metadata.source}-${doc.metadata.chunkIndex}-${Date.now()}-${i}`,
      text: doc.pageContent,
      embedding: vectors[i],
      metadata: {
        source: String(doc.metadata.source ?? 'unknown'),
        sourceName: String(doc.metadata.sourceName ?? 'unknown'),
        chunkIndex: Number(doc.metadata.chunkIndex ?? i),
      },
    }));

    await saveChunks([...existing, ...newChunks]);
    console.log(`[local] Stored ${newChunks.length} chunks (total: ${existing.length + newChunks.length})`);
  }

  async similaritySearch(query: string, k = 5): Promise<Document[]> {
    const chunks = await loadChunks();
    if (chunks.length === 0) return [];

    const queryEmbedding = await getEmbeddings().embedQuery(query);
    const ranked = chunks
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return ranked.map(({ chunk, score }) => ({
      pageContent: chunk.text,
      metadata: { ...chunk.metadata, score },
    }));
  }
}
