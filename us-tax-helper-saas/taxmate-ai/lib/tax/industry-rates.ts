/** 업종별 표준 비용 비율 (총수익 대비, IRS 통계 기반 추정치) */
export const INDUSTRY_DEDUCTION_RATES: Record<string, number> = {
  consulting: 0.12,
  'software development': 0.1,
  rideshare: 0.35,
  delivery: 0.3,
  'real estate': 0.2,
  healthcare: 0.15,
  construction: 0.25,
  retail: 0.28,
  marketing: 0.14,
  design: 0.12,
  default: 0.18,
};

export function getIndustryDeductionRate(industry?: string | null): number {
  if (!industry) return INDUSTRY_DEDUCTION_RATES.default;
  const key = industry.toLowerCase();
  return INDUSTRY_DEDUCTION_RATES[key] ?? INDUSTRY_DEDUCTION_RATES.default;
}
