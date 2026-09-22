'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExtractedTaxData } from '@/lib/documents/types';

type TaxDocumentRecord = {
  id: string;
  fileName: string;
  status: string;
  taxYear: number;
  documentType: string;
  aiExtractedData: ExtractedTaxData | null;
};

const POLL_INTERVAL_MS = 2500;

export function DocumentUploader() {
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState<TaxDocumentRecord | null>(null);
  const [formData, setFormData] = useState<ExtractedTaxData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pollDocument = useCallback(async (id: string) => {
    const res = await fetch(`/api/documents/${id}`);
    if (!res.ok) return null;
    const { document } = await res.json();
    return document as TaxDocumentRecord;
  }, []);

  useEffect(() => {
    if (!activeDoc || activeDoc.status === 'COMPLETED' || activeDoc.status === 'FAILED') {
      return;
    }

    const interval = setInterval(async () => {
      const doc = await pollDocument(activeDoc.id);
      if (!doc) return;
      setActiveDoc(doc);
      if (doc.status === 'COMPLETED' && doc.aiExtractedData) {
        setFormData(doc.aiExtractedData as ExtractedTaxData);
        clearInterval(interval);
      }
      if (doc.status === 'FAILED') {
        setError('문서 처리에 실패했습니다. 다시 업로드해 주세요.');
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeDoc, pollDocument]);

  const uploadFile = async (file: File) => {
    setError(null);
    setSuccessMsg(null);
    setIsUploading(true);
    setUploadProgress(0);

    const form = new FormData();
    form.append('file', file);
    form.append('taxYear', String(taxYear));

    try {
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error ?? 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', '/api/documents/upload');
        xhr.send(form);
      });

      const result = JSON.parse(xhr.responseText);
      setActiveDoc(result.document);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) void uploadFile(file);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [taxYear]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif'],
    },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    disabled: isUploading,
  });

  const updateField = (key: keyof ExtractedTaxData, value: string | number) => {
    if (!formData) return;
    setFormData({ ...formData, [key]: value });
  };

  const saveExtractedData = async () => {
    if (!activeDoc || !formData) return;
    setError(null);

    const res = await fetch(`/api/documents/${activeDoc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiExtractedData: formData }),
    });

    if (!res.ok) {
      setError('저장에 실패했습니다.');
      return;
    }
    setSuccessMsg('추출 데이터가 저장되었습니다.');
  };

  const addToTaxReturn = async () => {
    if (!activeDoc) return;
    setError(null);

    if (formData) {
      await fetch(`/api/documents/${activeDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiExtractedData: formData }),
      });
    }

    const res = await fetch(`/api/documents/${activeDoc.id}/add-to-return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxYear }),
    });

    if (!res.ok) {
      setError('세금 신고서에 추가하지 못했습니다.');
      return;
    }

    const data = await res.json();
    setSuccessMsg(
      `세금 신고서에 추가되었습니다. Schedule C 순소득 추정: $${data.incomeSummary?.netScheduleCIncome?.toLocaleString() ?? 0}`
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">문서 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxYear">과세 연도</Label>
              <Input
                id="taxYear"
                type="number"
                value={taxYear}
                onChange={(e) => setTaxYear(Number(e.target.value))}
                className="w-32"
              />
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-center font-medium">
              {isDragActive
                ? '여기에 놓으세요'
                : 'W-2, 1099, 영수증을 드래그하거나 클릭하세요'}
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              PDF, JPEG, PNG, HEIC · 최대 20MB
            </p>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>업로드 중...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {activeDoc && activeDoc.status === 'PROCESSING' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI가 문서에서 데이터를 추출하는 중...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              {successMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {formData && activeDoc?.status === 'COMPLETED' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              추출된 데이터 — {activeDoc.fileName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="문서 유형"
                value={formData.documentType}
                onChange={(v) => updateField('documentType', v)}
              />
              <Field
                label="과세 연도"
                type="number"
                value={String(formData.taxYear)}
                onChange={(v) => updateField('taxYear', Number(v))}
              />
              <Field
                label="지급자 (Payer)"
                value={formData.payerName ?? ''}
                onChange={(v) => updateField('payerName', v)}
              />
              <Field
                label="지급자 TIN"
                value={formData.payerTin ?? ''}
                onChange={(v) => updateField('payerTin', v)}
              />
              {formData.documentType === 'W2' && (
                <>
                  <Field
                    label="임금 (Wages)"
                    type="number"
                    value={String(formData.wages ?? '')}
                    onChange={(v) => updateField('wages', Number(v))}
                  />
                  <Field
                    label="연방 원천징수"
                    type="number"
                    value={String(formData.federalTaxWithheld ?? '')}
                    onChange={(v) => updateField('federalTaxWithheld', Number(v))}
                  />
                </>
              )}
              {formData.documentType === 'NEC1099' && (
                <Field
                  label="비고용 보수 (Box 1)"
                  type="number"
                  value={String(formData.nonemployeeCompensation ?? '')}
                  onChange={(v) => updateField('nonemployeeCompensation', Number(v))}
                />
              )}
              {formData.documentType === 'K1099' && (
                <Field
                  label="총 거래액"
                  type="number"
                  value={String(formData.grossAmount ?? '')}
                  onChange={(v) => updateField('grossAmount', Number(v))}
                />
              )}
              {formData.documentType === 'Receipt' && (
                <>
                  <Field
                    label="가맹점"
                    value={formData.merchantName ?? ''}
                    onChange={(v) => updateField('merchantName', v)}
                  />
                  <Field
                    label="금액"
                    type="number"
                    value={String(formData.expenseAmount ?? '')}
                    onChange={(v) => updateField('expenseAmount', Number(v))}
                  />
                  <Field
                    label="카테고리"
                    value={formData.expenseCategory ?? ''}
                    onChange={(v) => updateField('expenseCategory', v)}
                  />
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={saveExtractedData}>
                수정 내용 저장
              </Button>
              <Button onClick={addToTaxReturn}>세금 신고서에 추가</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
