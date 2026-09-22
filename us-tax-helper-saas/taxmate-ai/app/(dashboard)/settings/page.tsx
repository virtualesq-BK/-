import { SettingsForm } from '@/components/settings/SettingsForm';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">설정</h1>
        <p className="text-muted-foreground">프로필, 알림, 데이터 관리</p>
      </div>
      <SettingsForm />
    </div>
  );
}
