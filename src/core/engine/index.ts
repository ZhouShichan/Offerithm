import type { OfferCalcResult, Offer, RegionPolicy, TaxPolicy } from '../types';
import type { AnnualTaxInput } from './tax';
import { calculateAnnualTax, comprehensiveTax } from './tax';
import { aggregateSalary, monthlyInsuranceBase } from './salary';
import { calculateInsurance } from './insurance';
import { findPolicy } from '../../policies/regions';
import { taxPolicy2025 } from '../../policies/tax';

export interface CalcOptions {
  policy?: RegionPolicy;
  taxPolicy?: TaxPolicy;
  /** 专项附加扣除合计（元/年） */
  specialAdditionalDeductions?: number;
  /** 情景档位，默认 base */
  scenario?: 'pessimistic' | 'base' | 'optimistic';
}

/** 单个 Offer 全量计算：现金、社保、个税、成本、储蓄、时薪、3/10 年预测。 */
export function calculateOffer(offer: Offer, options: CalcOptions = {}): OfferCalcResult {
  const policy = options.policy ?? findPolicy(offer.regionPolicyId);
  const taxPolicy = options.taxPolicy ?? taxPolicy2025;
  const scenarioKey = options.scenario ?? 'base';
  const scenario = offer.scenarios[scenarioKey];

  const warnings: string[] = [];
  if (!policy) {
    warnings.push(`未找到地区政策 ${offer.regionPolicyId}，社保与公积金按 0 计算。请在设置中配置。`);
  }

  const salary = offer.salary;
  const agg = aggregateSalary(salary);
  const base = monthlyInsuranceBase(salary);
  const insurance = policy
    ? calculateInsurance(policy, base)
    : { employeeMonthly: 0, employerMonthly: 0, housingFundMonthly: 0, medicalAccountMonthly: 0, breakdown: [] };

  const employeeInsuranceAnnual = insurance.employeeMonthly * 12;

  const oneTimeTotal = offer.oneTimePayments.reduce((s, p) => s + p.amount, 0);
  const oneTimeTaxable = offer.oneTimePayments.filter((p) => p.taxable).reduce((s, p) => s + p.amount, 0);
  const bonus = agg.annualBonus * scenario.bonusMultiplier;

  const taxInput: AnnualTaxInput = {
    taxableIncomeExcludingBonus: agg.taxableAnnualExcludingBonus + oneTimeTaxable,
    annualBonus: bonus,
    bonusTaxMethod: salary.bonusTaxMethod,
    specialAdditionalDeductions: options.specialAdditionalDeductions ?? 0,
    socialInsuranceDeduction: employeeInsuranceAnnual,
  };
  const tax = calculateAnnualTax(taxInput, taxPolicy);
  if (salary.bonusTaxMethod === 'separate') {
    warnings.push('年终奖单独计税按现行优惠政策计算，该政策具有时效性，请确认入职当年仍然有效。');
  }

  const grossAnnualCash = agg.grossMonthly * 12 + bonus + oneTimeTotal;

  const netAnnualCash = grossAnnualCash - employeeInsuranceAnnual - tax.totalTax;
  const housingFundAnnual = insurance.housingFundMonthly * 12;
  const medicalAccountAnnual = insurance.medicalAccountMonthly * 12;

  const employerTotalCostAnnual = agg.grossMonthly * 12 + bonus + insurance.employerMonthly * 12 + oneTimeTotal;

  const lc = offer.livingCost;
  const livingCostAnnual =
    (lc.housing + lc.food + lc.transport + lc.utilities + lc.other) * 12 + lc.annualExtra;
  const annualSavings = netAnnualCash + housingFundAnnual - livingCostAnnual;

  // 时薪：年历约 50 个工作周，工作小时含通勤折半
  const annualHours = offer.work.weeklyHours * 50
    + ((offer.work.commuteMinutesOneWay * 2 * 5 * 50) / 60) * 0.5;
  const effectiveHourlyRate = annualHours > 0 ? grossAnnualCash / annualHours : 0;

  // 未来预测：按情景调薪率复利；长期预测置信度递减
  const raise = scenario.raiseRate;
  const project = (years: number) => grossAnnualCash * Math.pow(1 + raise, years - 1);
  const projection = {
    year1: { value: Math.round(grossAnnualCash), confidence: 0.95, note: '基于当前 Offer 条款' },
    year3: { value: Math.round(project(3)), confidence: 0.7, note: `假设年调薪 ${Math.round(raise * 100)}%（${scenarioKey} 情景），为估计值` },
    year10: { value: Math.round(project(10)), confidence: 0.4, note: `假设年调薪 ${Math.round(raise * 100)}% 复利外推 10 年，不确定性高，仅供参考` },
  };

  return {
    offerId: offer.id,
    grossAnnualCash: Math.round(grossAnnualCash),
    employeeInsuranceAnnual: Math.round(employeeInsuranceAnnual),
    employerInsuranceAnnual: Math.round(insurance.employerMonthly * 12),
    incomeTaxAnnual: tax.totalTax,
    netAnnualCash: Math.round(netAnnualCash),
    netMonthlyCash: Math.round(netAnnualCash / 12),
    housingFundAnnual: Math.round(housingFundAnnual),
    medicalAccountAnnual: Math.round(medicalAccountAnnual),
    employerTotalCostAnnual: Math.round(employerTotalCostAnnual),
    livingCostAnnual: Math.round(livingCostAnnual),
    annualSavings: Math.round(annualSavings),
    insuranceBreakdown: insurance.breakdown,
    effectiveHourlyRate: Math.round(effectiveHourlyRate),
    projection,
    warnings,
  };
}

export { aggregateSalary, monthlyInsuranceBase, calculateInsurance, calculateAnnualTax, comprehensiveTax };
