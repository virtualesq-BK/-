import { put, del } from '@vercel/blob';
import type { FileStorage, UploadResult } from './types';

export class VercelBlobStorage implements FileStorage {
  async upload(
    buffer: Buffer,
    options: { fileName: string; mimeType: string; userId: string }
  ): Promise<UploadResult> {
    const pathname = `documents/${options.userId}/${Date.now()}-${options.fileName}`;

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: options.mimeType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return {
      url: blob.url,
      key: blob.pathname,
      provider: 'vercel-blob',
    };
  }

  async download(keyOrUrl: string): Promise<Buffer> {
    const url = keyOrUrl.startsWith('http') ? keyOrUrl : `https://${keyOrUrl}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download blob: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

export async function deleteBlob(url: string) {
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
}
