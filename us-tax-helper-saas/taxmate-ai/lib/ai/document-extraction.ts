import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  ExtractedTaxDataSchema,
  type ExtractedTaxData,
} from '@/lib/documents/types';
import { parsePDF, parseWithOCR } from '@/lib/ai/document-parser';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACTION_PROMPT = `You are a US tax document data extraction specialist.
Extract structured data from W-2, 1099-NEC, 1099-K, or business receipt documents.
Return accurate numbers without currency symbols. Use documentType: W2, NEC1099, K1099, Receipt, or Other.
For 1099-NEC set nonemployeeCompensation. For W-2 set wages and federalTaxWithheld.
Include taxYear from the form. Set confidence 0-1 based on legibility.`;

export async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    const heicConvert = (await import('heic-convert')).default;
    const output = await heicConvert({
      buffer,
      format: 'JPEG',
      quality: 0.9,
    });
    return Buffer.from(output);
  } catch {
    return buffer;
  }
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === 'application/pdf') {
    return parsePDF(buffer);
  }

  let imageBuffer = buffer;
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    imageBuffer = await convertHeicToJpeg(buffer);
  }

  return parseWithOCR(imageBuffer);
}

export async function extractWithVision(
  buffer: Buffer,
  mimeType: string,
  ocrText: string
): Promise<ExtractedTaxData> {
  let imageBuffer = buffer;
  let mediaType = mimeType;

  if (mimeType === 'application/pdf') {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        {
          role: 'user',
          content: `Extract tax data from this PDF text:\n\n${ocrText.slice(0, 12000)}`,
        },
      ],
      response_format: zodResponseFormat(ExtractedTaxDataSchema, 'tax_document'),
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No extraction response');
    return ExtractedTaxDataSchema.parse(JSON.parse(content));
  }

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    imageBuffer = await convertHeicToJpeg(buffer);
    mediaType = 'image/jpeg';
  }

  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mediaType};base64,${base64}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `OCR reference (may be incomplete):\n${ocrText.slice(0, 4000)}\n\nExtract all tax fields from the image.`,
          },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
    response_format: zodResponseFormat(ExtractedTaxDataSchema, 'tax_document'),
    temperature: 0,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No vision extraction response');
  return ExtractedTaxDataSchema.parse(JSON.parse(content));
}

export async function extractTaxDocumentData(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedTaxData> {
  const ocrText = await extractTextFromBuffer(buffer, mimeType);
  const extracted = await extractWithVision(buffer, mimeType, ocrText);
  return {
    ...extracted,
    rawTextPreview: ocrText.slice(0, 500),
  };
}
