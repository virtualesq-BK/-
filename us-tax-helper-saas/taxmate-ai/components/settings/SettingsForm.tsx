'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { NotificationSettings } from '@/lib/notifications/types';

export function SettingsForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('FREE');
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setName(d.user?.name ?? '');
        setPhone(d.user?.phone ?? '');
        setEmail(d.user?.email ?? '');
        setTier(d.user?.subscriptionTier ?? 'FREE');
        setSettings(d.notificationSettings);
      });
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, notificationSettings: settings }),
    });
    setSaving(false);
    if (res.ok) toast.success('설정이 저장되었습니다');
    else toast.error('저장 실패');
  };

  const exportData = () => {
    window.open('/api/settings/export', '_blank');
    toast.success('데이터보내기 시작');
  };

  const manageBilling = async () => {
    const res = await fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? 'price_taxmate_pro',
      }),
    });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  };

  if (!settings) {
    return <p className="text-muted-foreground">로딩 중...</p>;
  }

  const toggle = (key: keyof NotificationSettings) => {
    setSettings((s) => (s ? { ...s, [key]: !s[key] } : s));
  };

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="profile">프로필</TabsTrigger>
        <TabsTrigger value="notifications">알림</TabsTrigger>
        <TabsTrigger value="data">데이터</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>프로필</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>이메일</Label>
              <Input value={email} disabled />
            </div>
            <div className="space-y-2">
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>전화 (SMS 알림)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              구독: <BadgeInline>{tier}</BadgeInline>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveProfile} disabled={saving}>
                저장
              </Button>
              <Button variant="outline" onClick={manageBilling}>
                결제 방법 변경
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notifications" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>알림 채널</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ['email', '이메일'],
                ['inApp', '앱 내 알림'],
                ['sms', 'SMS (중요 알림만)'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={settings[key]} onCheckedChange={() => toggle(key)} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>알림 유형</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ['documentProcessed', '문서 처리 완료'],
                ['cpaUpdates', 'CPA 검토 업데이트'],
                ['filingUpdates', '신고서 제출'],
                ['auditAlerts', '감사 위험 알림'],
                ['paymentReminders', '납부 기한 알림'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={settings[key]} onCheckedChange={() => toggle(key)} />
              </div>
            ))}
            <Button onClick={saveProfile} disabled={saving}>
              알림 설정 저장
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="data" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>데이터보내기 (GDPR / CCPA)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              계정에 저장된 모든 세무 데이터, 메시지, 알림 기록을 JSON 파일로
              다운로드합니다. 파일 URL은 보안상 제외됩니다.
            </p>
            <Button variant="outline" onClick={exportData}>
              데이터보내기
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function BadgeInline({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}
