import { S3FileStorage } from './s3';
import { VercelBlobStorage } from './vercel-blob';
import type { FileStorage } from './types';

export type StorageProvider = 's3' | 'vercel-blob';

export function getStorageProvider(): StorageProvider {
  const configured = process.env.STORAGE_PROVIDER as StorageProvider | undefined;
  if (configured === 's3' || configured === 'vercel-blob') return configured;
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  if (process.env.AWS_S3_BUCKET) return 's3';
  throw new Error(
    'No storage configured. Set STORAGE_PROVIDER and S3 or BLOB_READ_WRITE_TOKEN.'
  );
}

export function getFileStorage(): FileStorage {
  const provider = getStorageProvider();
  if (provider === 's3') return new S3FileStorage();
  return new VercelBlobStorage();
}

export type { FileStorage, UploadResult } from './types';
