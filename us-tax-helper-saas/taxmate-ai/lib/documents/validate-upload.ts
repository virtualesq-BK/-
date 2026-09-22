import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './types';

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function resolveMimeType(file: File): string | null {
  if (file.type && ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return file.type;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && EXTENSION_MIME[ext]) {
    return EXTENSION_MIME[ext];
  }

  return null;
}

export function validateUploadFile(file: File): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'File exceeds 20MB limit' };
  }

  const mimeType = resolveMimeType(file);
  if (!mimeType) {
    return {
      ok: false,
      error: 'Invalid file type. Allowed: PDF, JPEG, PNG, HEIC',
    };
  }

  return { ok: true, mimeType };
}
