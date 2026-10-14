import type { TaxPolicy } from '../types';

export interface AnnualTaxInput {
  /** 应税综合所得（不含年终奖，元/年） */
  taxableIncomeExcludingBonus: number;
  /** 年终奖（元/年） */
  annualBonus: number;
  bonusTaxMethod: 'separate' | 'combined';
  /** 专项附加扣除合计（元/年） */
  specialAdditionalDeductions: number;
  /** 个人缴纳的社保+公积金（元/年，作为专项扣除） */
  socialInsuranceDeduction: number;
}

export interface AnnualTaxResult {
  totalTax: number;
  comprehensiveTax: number;
  bonusTax: number;
  effectiveRate: number;
}

/** 综合所得应纳税额：超额累进，速算扣除数法。 */
export function comprehensiveTax(taxable: number, policy: TaxPolicy): number {
  if (taxable <= 0) return 0;
  const bracket = policy.annualBrackets.find((b) => b.upTo === null || taxable <= b.upTo)
    ?? policy.annualBrackets[policy.annualBrackets.length - 1]!;
  return Math.max(0, taxable * bracket.rate - bracket.quickDeduction);
}

/** 年终奖单独计税：年奖 / 12 找月度税率档。 */
function bonusSeparateTax(bonus: number, policy: TaxPolicy): number {
  if (bonus <= 0) return 0;
  const monthly = bonus / 12;
  const bracket = policy.annualBrackets.find((b) => b.upTo === null || monthly <= b.upTo! / 12)
    ?? policy.annualBrackets[policy.annualBrackets.length - 1]!;
  return Math.max(0, bonus * bracket.rate - bracket.quickDeduction);
}

/**
 * 年度个税。简化假设：按年度口径一次性计算，
 * 不模拟预扣预缴的逐月节奏；实际逐月到手由 UI 标注为近似分布。
 */
export function calculateAnnualTax(input: AnnualTaxInput, policy: TaxPolicy): AnnualTaxResult {
  const basicDeduction = policy.basicDeductionMonthly * 12;
  const deductions =
    basicDeduction + input.specialAdditionalDeductions + input.socialInsuranceDeduction;

  let comprehensiveTaxAmount: number;
  let bonusTaxAmount: number;

  if (input.bonusTaxMethod === 'separate') {
    const taxable = Math.max(0, input.taxableIncomeExcludingBonus - deductions);
    comprehensiveTaxAmount = comprehensiveTax(taxable, policy);
    bonusTaxAmount = bonusSeparateTax(input.annualBonus, policy);
  } else {
    const taxable = Math.max(0, input.taxableIncomeExcludingBonus + input.annualBonus - deductions);
    comprehensiveTaxAmount = comprehensiveTax(taxable, policy);
    bonusTaxAmount = 0;
  }

  const total = comprehensiveTaxAmount + bonusTaxAmount;
  const gross = input.taxableIncomeExcludingBonus + input.annualBonus;

  return {
    totalTax: Math.round(total),
    comprehensiveTax: Math.round(comprehensiveTaxAmount),
    bonusTax: Math.round(bonusTaxAmount),
    effectiveRate: gross > 0 ? total / gross : 0,
  };
}
