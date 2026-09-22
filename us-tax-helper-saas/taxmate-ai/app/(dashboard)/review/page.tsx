import { TaxDraftPanel } from '@/components/user/TaxDraftPanel';
import { ManualTaxInputForm } from '@/components/user/ManualTaxInputForm';
import { IrsSourceSearch } from '@/components/user/IrsSourceSearch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ReviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Tax Return & CPA Review</h1>
        <p className="text-muted-foreground">
          숫자만 입력해 바로 문서를 작성하거나, 업로드한 자료·대화 내역을 기반으로 AI 초안을
          생성한 뒤 CPA와 10분 검증을 진행하세요. 근거가 되는 IRS 공식 자료는 언제든
          &ldquo;IRS 근거자료 검색&rdquo; 탭에서 직접 확인할 수 있습니다.
        </p>
      </div>
      <Tabs defaultValue="manual" className="w-full">
        <TabsList>
          <TabsTrigger value="manual">숫자 입력으로 작성</TabsTrigger>
          <TabsTrigger value="ai">AI 자동 초안</TabsTrigger>
          <TabsTrigger value="sources">IRS 근거자료 검색</TabsTrigger>
        </TabsList>
        <TabsContent value="manual">
          <ManualTaxInputForm />
        </TabsContent>
        <TabsContent value="ai">
          <TaxDraftPanel />
        </TabsContent>
        <TabsContent value="sources">
          <IrsSourceSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}
