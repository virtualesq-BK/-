/**
 * IRS Publication ingestion script
 *
 * Usage:
 *   npm run ingest:irs
 *   VECTOR_STORE=local npm run ingest:irs
 *   VECTOR_STORE=pinecone npm run ingest:irs
 *
 * Requires: OPENAI_API_KEY
 * Pinecone: PINECONE_API_KEY, PINECONE_INDEX (dimension 1536 for text-embedding-3-small)
 */

import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { getIrsVectorStore } from '../ai/vector-store';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const IRS_PUBLICATIONS = [
  {
    id: 'pub-334',
    name: 'Pub 334 (Small Business Tax Guide)',
    url: 'https://www.irs.gov/pub/irs-pdf/p334.pdf',
  },
  {
    id: 'pub-535',
    name: 'Pub 535 (Business Expenses)',
    url: 'https://www.irs.gov/pub/irs-pdf/p535.pdf',
  },
  {
    id: 'pub-463',
    name: 'Pub 463 (Travel, Gift, and Car Expenses)',
    url: 'https://www.irs.gov/pub/irs-pdf/p463.pdf',
  },
  {
    id: 'pub-587',
    name: 'Pub 587 (Business Use of Your Home)',
    url: 'https://www.irs.gov/pub/irs-pdf/p587.pdf',
  },
  {
    id: 'pub-946',
    name: 'Pub 946 (Depreciation)',
    url: 'https://www.irs.gov/pub/irs-pdf/p946.pdf',
  },
  {
    id: 'schedule-c',
    name: 'Schedule C Instructions',
    url: 'https://www.irs.gov/pub/irs-pdf/i1040sc.pdf',
  },
] as const;

const CACHE_DIR = path.join(process.cwd(), 'data', 'irs-pdfs');

async function downloadPdf(url: string, filename: string): Promise<Buffer> {
  const filePath = path.join(CACHE_DIR, filename);
  await fs.mkdir(CACHE_DIR, { recursive: true });

  try {
    const cached = await fs.readFile(filePath);
    console.log(`  Using cached: ${filename}`);
    return cached;
  } catch {
    console.log(`  Downloading: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TaxMate-AI/1.0 (IRS document ingestion)' },
    });
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return buffer;
  }
}

async function pdfToText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text.replace(/\s+/g, ' ').trim();
}

async function ingestPublication(pub: (typeof IRS_PUBLICATIONS)[number]) {
  console.log(`\nProcessing ${pub.name}...`);
  const buffer = await downloadPdf(pub.url, `${pub.id}.pdf`);
  const text = await pdfToText(buffer);

  if (!text || text.length < 100) {
    console.warn(`  Warning: Very little text extracted from ${pub.id}`);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const rawChunks = await splitter.splitText(text);
  console.log(`  Split into ${rawChunks.length} chunks`);

  const documents = rawChunks.map(
    (chunk, index) =>
      new Document({
        pageContent: chunk,
        metadata: {
          source: pub.id,
          sourceName: pub.name,
          chunkIndex: index,
        },
      })
  );

  const store = getIrsVectorStore();

  // Batch upsert to avoid rate limits
  const BATCH = 50;
  for (let i = 0; i < documents.length; i += BATCH) {
    const batch = documents.slice(i, i + BATCH);
    await store.addDocuments(batch);
    console.log(`  Indexed chunks ${i + 1}-${Math.min(i + BATCH, documents.length)}`);
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const provider = process.env.VECTOR_STORE ?? (process.env.PINECONE_API_KEY ? 'pinecone' : 'local');
  console.log(`Vector store: ${provider}`);
  console.log(`Embedding model: ${process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'}`);

  for (const pub of IRS_PUBLICATIONS) {
    await ingestPublication(pub);
  }

  console.log('\n✅ IRS document ingestion complete.');
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
