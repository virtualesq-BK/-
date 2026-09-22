import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { FileStorage, UploadResult } from './types';

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export class S3FileStorage implements FileStorage {
  private bucket = process.env.AWS_S3_BUCKET!;
  private client = getS3Client();

  async upload(
    buffer: Buffer,
    options: { fileName: string; mimeType: string; userId: string }
  ): Promise<UploadResult> {
    const key = `documents/${options.userId}/${Date.now()}-${sanitizeFileName(options.fileName)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: options.mimeType,
      })
    );

    const region = process.env.AWS_REGION ?? 'us-east-1';
    const url =
      process.env.AWS_S3_PUBLIC_URL ??
      `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;

    return { url, key, provider: 's3' };
  }

  async download(keyOrUrl: string): Promise<Buffer> {
    const key = keyOrUrl.includes('amazonaws.com/')
      ? keyOrUrl.split('.amazonaws.com/')[1]
      : keyOrUrl;

    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );

    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error('Empty S3 object');
    return Buffer.from(bytes);
  }
}
