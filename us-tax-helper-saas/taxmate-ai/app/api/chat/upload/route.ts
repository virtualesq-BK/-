import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { parsePDF, parseWithOCR } from '@/lib/ai/document-parser';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const fileName = (file as File).name ?? 'upload';
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type;

  let extractedText = '';

  if (mime === 'application/pdf' || fileName.endsWith('.pdf')) {
    extractedText = await parsePDF(buffer);
  } else if (mime.startsWith('image/')) {
    extractedText = await parseWithOCR(buffer);
  } else {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PDF or image.' },
      { status: 400 }
    );
  }

  const trimmed = extractedText.trim().slice(0, 8000);

  return NextResponse.json({
    fileName,
    extractedText: trimmed || 'Could not extract text from file.',
  });
}
