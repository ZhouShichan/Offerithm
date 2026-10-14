import { describe, expect, it } from 'vitest';
import { comprehensiveTax, calculateAnnualTax } from '../tax';
import { calculateInsurance } from '../insurance';
import { aggregateSalary, tieredBonus } from '../salary';
import { calculateOffer } from '../index';
import { compareOffers, defaultWeights } from '../compare';
import { taxPolicy2025 } from '../../../policies/tax';
import { regionPolicies } from '../../../policies/regions';
import type { Offer } from '../../types';

const bj = regionPolicies[0]!;
const sh = regionPolicies[1]!;

describe('comprehensiveTax', () => {
  it('3% 档：应纳税所得 30000 → 900', () => {
    expect(comprehensiveTax(30000, taxPolicy2025)).toBe(900);
  });

  it('10% 档速算扣除：144000 → 14400 - 2520 = 11880', () => {
    expect(comprehensiveTax(144000, taxPolicy2025)).toBe(11880);
  });

  it('零应纳税所得为 0', () => {
    expect(comprehensiveTax(0, taxPolicy2025)).toBe(0);
  });
});

describe('calculateAnnualTax', () => {
  const base = {
    taxableIncomeExcludingBonus: 200000,
    annualBonus: 0,
    bonusTaxMethod: 'combined' as const,
    specialAdditionalDeductions: 0,
    socialInsuranceDeduction: 0,
  };

  it('扣除 60000 基本费用后按 10% 档', () => {
    // 140000 * 0.1 - 2520 = 11480
    expect(calculateAnnualTax(base, taxPolicy2025).totalTax).toBe(11480);
  });

  it('专项附加扣除减少税额', () => {
    const t1 = calculateAnnualTax(base, taxPolicy2025).totalTax;
    const t2 = calculateAnnualTax(
      { ...base, specialAdditionalDeductions: 48000 },
      taxPolicy2025,
    ).totalTax;
    expect(t2).toBeLessThan(t1);
  });

  it('年终奖单独计税：36000 元按 3% → 1080', () => {
    const r = calculateAnnualTax(
      { ...base, annualBonus: 36000, bonusTaxMethod: 'separate' },
      taxPolicy2025,
    );
    expect(r.bonusTax).toBe(1080);
  });
});

describe('calculateInsurance', () => {
  it('基数受上限约束', () => {
    const r = calculateInsurance(bj, 999999);
    const pension = r.breakdown.find((b) => b.name === '养老保险')!;
    expect(pension.employeeMonthly).toBeCloseTo(35283 * 0.08, 2);
    expect(pension.employerMonthly).toBeCloseTo(35283 * 0.16, 2);
  });

  it('北京公积金 12%+12% 计入个人账户', () => {
    const r = calculateInsurance(bj, 20000);
    expect(r.housingFundMonthly).toBeCloseTo(20000 * 0.24, 2);
  });

  it('上海补充公积金叠加后为 (7%+5%)*2', () => {
    const r = calculateInsurance(sh, 20000);
    expect(r.housingFundMonthly).toBeCloseTo(20000 * 0.24, 2);
  });

  it('企业年金由双方缴纳', () => {
    const withAnnuity = {
      ...bj,
      rates: { ...bj.rates, enterpriseAnnuity: { employee: 0.04, employer: 0.08, personalAccount: true } },
    };
    const r = calculateInsurance(withAnnuity, 20000);
    const ann = r.breakdown.find((b) => b.name === '企业年金')!;
    expect(ann.employeeMonthly).toBeCloseTo(800, 2);
    expect(ann.employerMonthly).toBeCloseTo(1600, 2);
  });
});

describe('tieredBonus / aggregateSalary', () => {
  it('阶梯奖金分段累进', () => {
    const rule = {
      id: 't1',
      name: '提成',
      base: 'monthlyBase' as const,
      tiers: [
        { upTo: 120000, rate: 0.05 },
        { upTo: 240000, rate: 0.1 },
        { upTo: null, rate: 0.15 },
      ],
    };
    expect(tieredBonus(rule, 10000)).toBeCloseTo(6000, 6); // 120000 * 5%
    expect(tieredBonus(rule, 20000)).toBeCloseTo(18000, 6); // +120000 * 10%
  });

  it('聚合：月度/季度组件与年终奖', () => {
    const agg = aggregateSalary({
      baseMonthly: 10000,
      annualBonus: 30000,
      bonusTaxMethod: 'separate',
      components: [
        { id: '1', name: '交通补贴', frequency: 'monthly', amountType: 'fixed', amount: 500, countsTowardInsuranceBase: false, taxable: true },
        { id: '2', name: '季度绩效', frequency: 'quarterly', amountType: 'fixed', amount: 3000, countsTowardInsuranceBase: false, taxable: true },
      ],
      tieredBonusRules: [],
    });
    expect(agg.grossMonthly).toBe(10500);
    expect(agg.grossAnnual).toBe(168000); // 10500*12 + 12000 + 30000
    expect(agg.annualBonus).toBe(30000);
  });
});

function makeOffer(id: string, baseMonthly: number, weeklyHours: number): Offer {
  return {
    id,
    name: id,
    companyName: 'X',
    regionPolicyId: bj.id,
    salary: {
      baseMonthly,
      annualBonus: baseMonthly,
      bonusTaxMethod: 'separate',
      components: [],
      tieredBonusRules: [],
    },
    scenarios: {
      pessimistic: { raiseRate: 0.02, bonusMultiplier: 0.5 },
      base: { raiseRate: 0.05, bonusMultiplier: 1 },
      optimistic: { raiseRate: 0.1, bonusMultiplier: 1.5 },
    },
    livingCost: { housing: 3000, food: 2000, transport: 300, utilities: 200, other: 500, annualExtra: 0 },
    work: { weeklyHours, commuteMinutesOneWay: 30, travelDaysPerMonth: 0, annualLeaveDays: 5 },
    oneTimePayments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('calculateOffer', () => {
  it('税后 = 税前 - 个人社保 - 个税；储蓄 = 税后 + 公积金 - 生活成本', () => {
    const offer = makeOffer('a', 20000, 40);
    const r = calculateOffer(offer);
    expect(r.netAnnualCash).toBeCloseTo(
      r.grossAnnualCash - r.employeeInsuranceAnnual - r.incomeTaxAnnual, 0);
    expect(r.annualSavings).toBeCloseTo(
      r.netAnnualCash + r.housingFundAnnual - r.livingCostAnnual, 0);
    expect(r.warnings.length).toBeGreaterThan(0); // 年终奖单独计税提示
  });

  it('乐观情景年终奖放大、悲观缩小', () => {
    const offer = makeOffer('a', 20000, 40);
    const base = calculateOffer(offer).grossAnnualCash;
    const low = calculateOffer(offer, { scenario: 'pessimistic' }).grossAnnualCash;
    const high = calculateOffer(offer, { scenario: 'optimistic' }).grossAnnualCash;
    expect(low).toBeLessThan(base);
    expect(base).toBeLessThan(high);
  });

  it('工时越长时薪越低', () => {
    const easy = calculateOffer(makeOffer('a', 20000, 40)).effectiveHourlyRate;
    const hard = calculateOffer(makeOffer('b', 20000, 60)).effectiveHourlyRate;
    expect(hard).toBeLessThan(easy);
  });
});

describe('compareOffers', () => {
  it('高储蓄 Offer 得分更高（默认权重）', () => {
    const offers = [makeOffer('low', 15000, 50), makeOffer('high', 25000, 40)];
    const results = offers.map((o) => calculateOffer(o));
    const ranked = compareOffers(offers, results, defaultWeights);
    expect(ranked[0]!.offerId).toBe('high');
  });
});
