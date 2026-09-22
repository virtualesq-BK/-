'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  getOnboardingPercent,
  ONBOARDING_STEPS,
  type OnboardingProgress,
} from '@/lib/onboarding/types';

const STEP_LABELS = ['Business info', 'Documents', 'CPA preference', 'Subscription'];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [step1, setStep1] = useState<{
    businessName: string;
    businessType: 'LLC' | 'SoleProp' | 'SCorp' | 'Partnership';
    industry: string;
    employeeCount: number;
    state: string;
  }>({
    businessName: '',
    businessType: 'LLC',
    industry: '',
    employeeCount: 0,
    state: '',
  });
  const [uploadCount, setUploadCount] = useState(0);
  const [cpaPreference, setCpaPreference] = useState<'auto' | 'manual'>('auto');

  const loadProgress = useCallback(async () => {
    const res = await fetch('/api/onboarding');
    if (res.ok) {
      const data = await res.json();
      if (data.completed) {
        router.replace('/dashboard');
        return;
      }
      const p = data.progress as OnboardingProgress | null;
      if (p) {
        setProgress(p);
        setStep(p.currentStep || 1);
        if (p.data.step1) {
          setStep1({
            businessName: p.data.step1.businessName,
            businessType: p.data.step1.businessType,
            industry: p.data.step1.industry,
            employeeCount: p.data.step1.employeeCount,
            state: p.data.step1.state ?? '',
          });
        }
        if (p.data.step2) setUploadCount(p.data.step2.documentsUploaded ?? 0);
        if (p.data.step3) setCpaPreference(p.data.step3.cpaPreference);
      }
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const saveStep = async (stepNum: number, data: unknown, advance = true) => {
    setSaving(true);
    const res = await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: stepNum, data }),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error('저장에 실패했습니다');
      return false;
    }

    const result = await res.json();
    setProgress(result.progress);
    if (advance && stepNum < ONBOARDING_STEPS) {
      setStep(stepNum + 1);
    }
    toast.success('진행 상황이 저장되었습니다');
    return true;
  };

  const onDrop = useCallback(async (files: File[]) => {
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/documents/upload', { method: 'POST', body: form });
      if (res.ok) {
        setUploadCount((c) => c + 1);
        toast.success(`${file.name} 업로드됨`);
      } else {
        toast.error(`${file.name} 업로드 실패`);
      }
    }
    await saveStep(2, { documentsUploaded: uploadCount + files.length }, false);
  }, [uploadCount]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: true,
  });

  const completeOnboarding = async () => {
    setSaving(true);
    const res = await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 4,
        data: { subscriptionComplete: true },
        complete: true,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('온보딩이 완료되었습니다!');
      router.push('/dashboard');
    }
  };

  const startCheckout = async () => {
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? 'price_taxmate_pro';
    const res = await fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    if (res.ok) {
      const { url } = await res.json();
      await saveStep(4, { priceId }, false);
      if (url) window.location.href = url;
    } else {
      toast.error('결제 세션 생성 실패');
    }
  };

  const percent = getOnboardingPercent(progress ?? { currentStep: step, completedSteps: [], data: {} });

  if (loading) {
    return <p className="text-center text-muted-foreground py-12">불러오는 중...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">TaxMate 설정</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          단계 {step} / {ONBOARDING_STEPS} — {STEP_LABELS[step - 1]}
        </p>
        <Progress value={percent} className="mt-4" />
        <div className="mt-2 flex flex-wrap gap-2">
          {STEP_LABELS.map((label, i) => (
            <Badge
              key={label}
              variant={i + 1 <= step ? 'default' : 'secondary'}
              className="text-xs"
            >
              {label}
            </Badge>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>기본 사업 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>사업체명</Label>
              <Input
                value={step1.businessName}
                onChange={(e) => setStep1({ ...step1, businessName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>사업 유형</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={step1.businessType}
                onChange={(e) =>
                  setStep1({
                    ...step1,
                    businessType: e.target.value as typeof step1.businessType,
                  })
                }
              >
                <option value="LLC">LLC</option>
                <option value="SoleProp">Sole Proprietorship</option>
                <option value="SCorp">S-Corp</option>
                <option value="Partnership">Partnership</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>업종</Label>
              <Input
                placeholder="e.g. consulting, rideshare"
                value={step1.industry}
                onChange={(e) => setStep1({ ...step1, industry: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>직원 수</Label>
                <Input
                  type="number"
                  min={0}
                  value={step1.employeeCount}
                  onChange={(e) =>
                    setStep1({ ...step1, employeeCount: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>주 (State)</Label>
                <Input
                  placeholder="CA"
                  value={step1.state}
                  onChange={(e) => setStep1({ ...step1, state: e.target.value })}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={saving || !step1.businessName || !step1.industry}
              onClick={() => saveStep(1, step1)}
            >
              다음
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>문서 업로드</CardTitle>
            <p className="text-sm text-muted-foreground">
              지난 3년치 세금 신고서·W-2·1099 업로드를 권장합니다
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center ${
                isDragActive ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-sm">드래그 앤 드롭 또는 클릭하여 업로드</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {uploadCount}개 파일 업로드됨
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                이전
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  saveStep(2, { documentsUploaded: uploadCount, skipped: uploadCount === 0 })
                }
              >
                {uploadCount > 0 ? '다음' : '건너뛰기'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>CPA 선호도</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => setCpaPreference('auto')}
              className={`w-full rounded-lg border p-4 text-left ${
                cpaPreference === 'auto' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <p className="font-medium">자동 매칭 (권장)</p>
              <p className="text-sm text-muted-foreground">
                업종·위치·평점 기반 최적 CPA 배정
              </p>
            </button>
            <button
              type="button"
              onClick={() => setCpaPreference('manual')}
              className={`w-full rounded-lg border p-4 text-left ${
                cpaPreference === 'manual' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <p className="font-medium">직접 선택</p>
              <p className="text-sm text-muted-foreground">
                CPA 목록에서 직접 선택
              </p>
            </button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                이전
              </Button>
              <Button className="flex-1" onClick={() => saveStep(3, { cpaPreference })}>
                다음
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>구독 결제</CardTitle>
            <p className="text-sm text-muted-foreground">
              TaxMate Pro — 월 $19–29, AI 초안 + CPA 검토 포함
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={startCheckout} disabled={saving}>
              Stripe Checkout으로 결제
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={completeOnboarding}
              disabled={saving}
            >
              나중에 결제 (무료로 시작)
            </Button>
            <Button variant="ghost" onClick={() => setStep(3)}>
              이전
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
