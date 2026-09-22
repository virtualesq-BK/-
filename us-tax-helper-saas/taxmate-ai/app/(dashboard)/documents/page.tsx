import { DocumentUploader } from '@/components/documents/DocumentUploader';

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Documents</h1>
        <p className="text-muted-foreground">
          Upload W-2s, 1099s, receipts, and other tax documents
        </p>
      </div>
      <DocumentUploader />
    </div>
  );
}
