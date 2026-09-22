export type UploadResult = {
  url: string;
  key: string;
  provider: 's3' | 'vercel-blob';
};

export interface FileStorage {
  upload(
    buffer: Buffer,
    options: {
      fileName: string;
      mimeType: string;
      userId: string;
    }
  ): Promise<UploadResult>;
  download(keyOrUrl: string): Promise<Buffer>;
}
