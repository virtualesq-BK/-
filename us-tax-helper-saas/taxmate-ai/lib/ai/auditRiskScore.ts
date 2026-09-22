import { prisma } from '@/lib/db/prisma';

export type RiskFactor = {
  category: string;
  description: string;
  points: number;
  severity: 'low' | 'medium' | 'high';
};

export type AuditRiskResult = {
  overallScore: number;
  riskFactors: RiskFactor[];
  mitigationSuggestions: string[];
  alertRequired: boolean;
};

const HIGH_RISK_PATTERNS: Array<{
  category: string;
  patterns: RegExp[];
  points: number;
  severity: RiskFactor['severity'];
  mitigation: string;
}> = [
  {
    category: 'Home Office Deduction',
    patterns: [/home office|home-office|business use of home|pub 587/i, /홈오피스|재택|가정 내 사업/i],
    points: 25,
    severity: 'high',
    mitigation:
      'Exclusive and regular use 테스트를 충족하는지 확인하고, Pub 587의 simplified vs actual method 중 적합한 방식을 선택하세요. 사업 비율 산정 근거를 보관하세요.',
  },
  {
    category: 'Vehicle Deduction',
    patterns: [/vehicle|car expense|mileage|standard mileage|pub 463/i, /차량|마일리지|주행/i],
    points: 22,
    severity: 'high',
    mitigation:
      '마일리지 로그(날짜, 목적, 마일)를 유지하거나 actual expense 방식 선택 시 영수증을 분리 보관하세요. Pub 463 기준을 따르세요.',
  },
  {
    category: 'Cash Transactions',
    patterns: [/cash (payment|income|transaction)|unreported cash|현금 (거래|수입)/i],
    points: 20,
    severity: 'high',
    mitigation:
      '현금 수입·지출을 장부에 기록하고 은행 입출금과 대조하세요. Form 8300 신고 의무(해당 시)를 검토하세요.',
  },
  {
    category: 'Large Meal & Entertainment',
    patterns: [/meal deduction|entertainment|50%|식대|접대/i],
    points: 12,
    severity: 'medium',
    mitigation: '사업 목적, 참석자, 금액이 기재된 영수증을 보관하고 50% 한도를 적용하세요.',
  },
  {
    category: 'Depreciation',
    patterns: [/depreciation|section 179|bonus depreciation|pub 946/i, /감가상각|179조/i],
    points: 15,
    severity: 'medium',
    mitigation: '자산 분류와 사용 연한을 Pub 946에 맞게 설정하고 Form 4562 일관성을 유지하세요.',
  },
  {
    category: 'Schedule C Net Loss',
    patterns: [/schedule c loss|hobby loss|loss year after year|적자.*연속/i],
    points: 18,
    severity: 'high',
    mitigation: '사업 vs 취미(hobby) 9-factor 테스트를 검토하고 이익 실현 노력을 문서화하세요.',
  },
  {
    category: 'High Deduction Ratio',
    patterns: [/100% deduction|all expenses deductible|전액 공제/i],
    points: 10,
    severity: 'medium',
    mitigation: '개인·사업 비용을 분리하고 Pub 535의 nondeductible 항목을 재확인하세요.',
  },
];

function analyzeText(text: string): RiskFactor[] {
  const factors: RiskFactor[] = [];

  for (const rule of HIGH_RISK_PATTERNS) {
    const matched = rule.patterns.some((p) => p.test(text));
    if (matched) {
      factors.push({
        category: rule.category,
        description: `Detected discussion related to ${rule.category}`,
        points: rule.points,
        severity: rule.severity,
      });
    }
  }

  return factors;
}

export function calculateAuditRiskScore(
  userMessage: string,
  assistantMessage: string
): AuditRiskResult {
  const combined = `${userMessage}\n${assistantMessage}`;
  const riskFactors = analyzeText(combined);

  const uniqueByCategory = new Map<string, RiskFactor>();
  for (const factor of riskFactors) {
    const existing = uniqueByCategory.get(factor.category);
    if (!existing || factor.points > existing.points) {
      uniqueByCategory.set(factor.category, factor);
    }
  }

  const deduped = Array.from(uniqueByCategory.values());
  const overallScore = Math.min(
    100,
    deduped.reduce((sum, f) => sum + f.points, 0)
  );

  const mitigationSuggestions = deduped.map((f) => {
    const rule = HIGH_RISK_PATTERNS.find((r) => r.category === f.category);
    return rule?.mitigation ?? `Review ${f.category} documentation with your CPA.`;
  });

  if (deduped.length === 0) {
    mitigationSuggestions.push(
      '현재 대화에서 고위험 감사 트리거가 감지되지 않았습니다. 연말 정산 전 CPA 검토를 권장합니다.'
    );
  }

  return {
    overallScore,
    riskFactors: deduped,
    mitigationSuggestions: Array.from(new Set(mitigationSuggestions)),
    alertRequired: overallScore >= 70,
  };
}

export async function persistAuditRiskScore(params: {
  userId: string;
  taxReturnId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<AuditRiskResult> {
  const result = calculateAuditRiskScore(
    params.userMessage,
    params.assistantMessage
  );

  await prisma.auditRiskScore.create({
    data: {
      userId: params.userId,
      taxReturnId: params.taxReturnId,
      overallScore: result.overallScore,
      riskFactors: result.riskFactors,
      mitigationSuggestions: result.mitigationSuggestions,
    },
  });

  if (result.alertRequired) {
    const { notifyAuditRiskSpike } = await import('@/lib/notifications/notify');
    await notifyAuditRiskSpike(params.userId, result.overallScore);
  }

  return result;
}

export async function getOrCreateCurrentTaxReturn(userId: string) {
  const taxYear = new Date().getFullYear() - 1;

  return prisma.taxReturn.upsert({
    where: {
      userId_taxYear: { userId, taxYear },
    },
    create: {
      userId,
      taxYear,
      status: 'DRAFT',
    },
    update: {},
  });
}
