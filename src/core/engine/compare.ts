import type { ComparisonResult, ComparisonWeights, Criterion, Offer, OfferCalcResult } from '../types';

const CRITERIA: Criterion[] = ['netCash', 'savings', 'workLifeBalance', 'growth', 'stability', 'benefits'];

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 100);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

/**
 * 多 Offer 加权比较。评分 0-100，权重由用户自定义；
 * growth/stability/benefits 为定性维度，此处由 proxy 指标近似
 * （乐观-悲观情景差、企业成本规模、公积金+医保+年金）并明确标注为估计。
 */
export function compareOffers(
  offers: Offer[],
  results: OfferCalcResult[],
  weights: ComparisonWeights,
): ComparisonResult[] {
  if (offers.length === 0) return [];

  const netCash = normalize(results.map((r) => r.netAnnualCash));
  const savings = normalize(results.map((r) => r.annualSavings));
  // 工作生活平衡：每周小时 + 通勤折算，越少越好
  const load = offers.map(
    (o) => o.work.weeklyHours + (o.work.commuteMinutesOneWay * 2 * 5) / 60,
  );
  const balance = normalize(load.map((v) => -v));
  // 成长性：乐观情景相对悲观的调薪差
  const growth = normalize(
    offers.map((o) => o.scenarios.optimistic.raiseRate - o.scenarios.pessimistic.raiseRate),
  );
  // 稳定性：企业总成本规模（粗略代理，UI 标注为估计）
  const stability = normalize(results.map((r) => r.employerTotalCostAnnual));
  // 福益：公积金 + 医保个账
  const benefits = normalize(
    results.map((r) => r.housingFundAnnual + r.medicalAccountAnnual),
  );

  const scores: Record<Criterion, number[]> = {
    netCash,
    savings,
    workLifeBalance: balance,
    growth,
    stability,
    benefits,
  };

  const weightSum = CRITERIA.reduce((s, c) => s + (weights[c] ?? 0), 0) || 1;

  return offers
    .map((offer, i) => {
      const criterionScores = {} as Record<Criterion, number>;
      let total = 0;
      for (const c of CRITERIA) {
        criterionScores[c] = Math.round(scores[c][i] ?? 0);
        total += criterionScores[c] * (weights[c] ?? 0);
      }
      return {
        offerId: offer.id,
        name: offer.name,
        totalScore: Math.round(total / weightSum),
        criterionScores,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

export const defaultWeights: ComparisonWeights = {
  netCash: 25,
  savings: 25,
  workLifeBalance: 20,
  growth: 15,
  stability: 10,
  benefits: 5,
};

export const criterionLabels: Record<Criterion, string> = {
  netCash: '税后到手',
  savings: '年度储蓄',
  workLifeBalance: '工作生活平衡',
  growth: '成长性',
  stability: '稳定性',
  benefits: '福利价值',
};
