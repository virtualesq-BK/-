/**
 * Ingest the already-crawled IRS site data (data/index.jsonl + data/html/*.json
 * + data/pdf/*.json + data/pdf/*.pdf) into the RAG vector store, using
 * Summary-Augmented Chunking (SAC):
 *
 *   1. For each source document, generate a short LLM summary of the whole
 *      document (what it covers, which form/topic).
 *   2. Split the document into overlapping chunks.
 *   3. Prepend the doc-level summary to every chunk before embedding, so each
 *      chunk carries broader context even though only a slice of the source
 *      text is present — this measurably improves retrieval precision vs.
 *      naive fixed-size chunking, especially on long IRS instruction pages
 *      where a mid-document paragraph is meaningless without knowing which
 *      form/section it belongs to.
 *
 * This only ever reads from taxmate-ai/data (the crawler's own output) —
 * it does not touch any personal/third-party files outside the repo.
 *
 * Usage:
 *   npm run ingest:irs:crawled
 *   VECTOR_STORE=local npm run ingest:irs:crawled
 *   INGEST_LIMIT=20 npm run ingest:irs:crawled   # smoke test on a subset
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import readline from 'readline';
import pdf from 'pdf-parse';
import OpenAI from 'openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { getIrsVectorStore } from '../ai/vector-store';
import { openAIClientOptions } from '../ai/openai-config';

const DATA_DIR = path.join(process.cwd(), 'data');
const INDEX_PATH = path.join(DATA_DIR, 'index.jsonl');
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL ?? 'gpt-4o-mini';
const MIN_TEXT_LENGTH = 200;

const openai = new OpenAI(openAIClientOptions());

type IndexEntry = {
  type: 'html' | 'pdf';
  url: string;
  path: string;
  title?: string;
  form_number?: string;
  fetched_at: string;
  low_quality?: boolean;
};

async function readIndex(): Promise<IndexEntry[]> {
  const entries: IndexEntry[] = [];
  const rl = readline.createInterface({
    input: fsSync.createReadStream(INDEX_PATH, 'utf-8'),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as IndexEntry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

function resolveDataPath(relPath: string): string {
  // index.jsonl stores Windows-style backslash paths ("data\\html\\x.json")
  const normalized = relPath.replace(/\\/g, path.sep).replace(/\//g, path.sep);
  return path.isAbsolute(normalized)
    ? normalized
    : path.join(process.cwd(), normalized);
}

async function extractText(entry: IndexEntry): Promise<{ text: string; title: string } | null> {
  if (entry.type === 'html') {
    const filePath = resolveDataPath(entry.path);
    const raw = await fs.readFile(filePath, 'utf-8');
    const doc = JSON.parse(raw) as { text?: string; title?: string };
    const text = (doc.text ?? '').replace(/\s+/g, ' ').trim();
    return { text, title: doc.title ?? entry.title ?? entry.url };
  }

  // pdf: the sibling .pdf file holds the binary; the .json is metadata-only
  const pdfPath = resolveDataPath(entry.path).replace(/\.json$/i, '.pdf');
  try {
    const buffer = await fs.readFile(pdfPath);
    const data = await pdf(buffer);
    const text = data.text.replace(/\s+/g, ' ').trim();
    return { text, title: entry.title ?? entry.form_number ?? entry.url };
  } catch (err) {
    console.warn(`  Skipping (no readable PDF): ${pdfPath} — ${(err as Error).message}`);
    return null;
  }
}

async function summarizeDoc(title: string, text: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback: no LLM available, use a truncated lede as a pseudo-summary.
    return `${title}: ${text.slice(0, 300)}`;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: SUMMARY_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Summarize this IRS web page or form/instruction document in 2-3 sentences: what form or topic it covers, who it applies to, and the key numbers/rules if any. Be factual, no speculation.',
        },
        { role: 'user', content: `Title: ${title}\n\nContent:\n${text.slice(0, 6000)}` },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || title;
  } catch (err) {
    console.warn(`  Summary generation failed for "${title}": ${(err as Error).message}`);
    return title;
  }
}

async function ingestEntry(entry: IndexEntry, index: number, total: number): Promise<number> {
  const label = entry.form_number ?? entry.title ?? entry.url;
  console.log(`[${index + 1}/${total}] ${entry.type.toUpperCase()} ${label}`);

  if (entry.low_quality) {
    console.log('  Skipping (marked low_quality by crawler)');
    return 0;
  }

  const extracted = await extractText(entry);
  if (!extracted || extracted.text.length < MIN_TEXT_LENGTH) {
    console.log('  Skipping (insufficient text)');
    return 0;
  }

  const summary = await summarizeDoc(extracted.title, extracted.text);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const rawChunks = await splitter.splitText(extracted.text);

  const source = entry.form_number ?? entry.url.replace('https://www.irs.gov/', '');
  const documents = rawChunks.map(
    (chunk, i) =>
      new Document({
        // SAC: doc-level summary prepended so this chunk's embedding reflects
        // the whole document's context, not just this slice.
        pageContent: `[Document summary: ${summary}]\n\n${chunk}`,
        metadata: {
          source,
          sourceName: extracted.title,
          sourceUrl: entry.url,
          formNumber: entry.form_number ?? null,
          docType: entry.type,
          chunkIndex: i,
          summary,
        },
      })
  );

  const store = getIrsVectorStore();
  const BATCH = 50;
  for (let i = 0; i < documents.length; i += BATCH) {
    const batch = documents.slice(i, i + BATCH);
    await store.addDocuments(batch);
  }
  console.log(`  Indexed ${documents.length} SAC chunks`);
  return documents.length;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      'OPENAI_API_KEY not set — embeddings will fail. Set it before running for real.'
    );
  }

  const provider = process.env.VECTOR_STORE ?? (process.env.PINECONE_API_KEY ? 'pinecone' : 'local');
  console.log(`Vector store: ${provider}`);
  console.log(`Chunking: SAC (summary-augmented), size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP}`);

  const entries = await readIndex();
  const limit = process.env.INGEST_LIMIT ? Number(process.env.INGEST_LIMIT) : entries.length;
  const targeted = entries.slice(0, limit);

  console.log(`Found ${entries.length} crawled documents, processing ${targeted.length}\n`);

  let totalChunks = 0;
  let processed = 0;
  for (const entry of targeted) {
    try {
      totalChunks += await ingestEntry(entry, processed, targeted.length);
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}`);
    }
    processed++;
  }

  console.log(`\n✅ Ingestion complete. ${processed} documents processed, ${totalChunks} chunks indexed.`);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
