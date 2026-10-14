import type { SalaryStructure, TieredBonusRule } from '../types';

/** 计入社保基数的月度部分（基本工资 + 计入基数的月度组件）。 */
export function monthlyInsuranceBase(salary: SalaryStructure): number {
  const monthlyComponents = salary.components
    .filter((c) => c.frequency === 'monthly' && c.countsTowardInsuranceBase)
    .reduce((sum, c) => sum + (c.amountType === 'percentOfBase' ? (salary.baseMonthly * c.amount) / 100 : c.amount), 0);
  return salary.baseMonthly + monthlyComponents;
}

/** 阶梯奖金：超出阈值部分按对应档 rate 计提。 */
export function tieredBonus(rule: TieredBonusRule, monthlyBase: number): number {
  const annualBase = rule.base === 'monthlyBase' ? monthlyBase * 12 : monthlyBase;
  let remaining = annualBase;
  let lower = 0;
  let total = 0;
  for (const tier of rule.tiers) {
    if (remaining <= 0) break;
    const upper = tier.upTo ?? Number.POSITIVE_INFINITY;
    const span = Math.min(remaining, upper - lower);
    total += span * tier.rate;
    remaining -= span;
    lower = upper;
  }
  return total;
}

export interface SalaryAggregates {
  /** 月度税前现金（不含年终奖与一次性） */
  grossMonthly: number;
  /** 年度税前现金（含年终奖、季度/年度组件、一次性与阶梯奖金） */
  grossAnnual: number;
  /** 计税的年度所得（不含年终奖，排除免税项） */
  taxableAnnualExcludingBonus: number;
  annualBonus: number;
}

/** 聚合薪资结构。所有金额单位：元。 */
export function aggregateSalary(salary: SalaryStructure): SalaryAggregates {
  const monthlyBase = salary.baseMonthly;
  let grossMonthly = monthlyBase;
  let annualRegular = monthlyBase * 12;

  for (const c of salary.components) {
    const amount = c.amountType === 'percentOfBase' ? (monthlyBase * c.amount) / 100 : c.amount;
    switch (c.frequency) {
      case 'monthly':
        grossMonthly += amount;
        annualRegular += amount * 12;
        break;
      case 'quarterly':
        annualRegular += amount * 4;
        break;
      case 'annual':
      case 'oneTime':
        annualRegular += amount;
        break;
    }
  }

  const tiered = salary.tieredBonusRules.reduce((sum, r) => sum + tieredBonus(r, monthlyBase), 0);

  const taxableComponents = salary.components
    .filter((c) => c.taxable)
    .reduce((sum, c) => {
      const amount = c.amountType === 'percentOfBase' ? (monthlyBase * c.amount) / 100 : c.amount;
      return sum + (c.frequency === 'monthly' ? amount * 12 : c.frequency === 'quarterly' ? amount * 4 : amount);
    }, 0);

  const annualBonus = salary.annualBonus + tiered;

  return {
    grossMonthly,
    grossAnnual: annualRegular + annualBonus,
    taxableAnnualExcludingBonus: monthlyBase * 12 + taxableComponents,
    annualBonus,
  };
}
