import pdf from 'pdf-parse';

export async function parsePDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}

export async function parseWithOCR(imageBuffer: Buffer): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const {
    data: { text },
  } = await worker.recognize(imageBuffer);
  await worker.terminate();
  return text;
}
