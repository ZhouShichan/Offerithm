import type { IncomeTaxResult, TaxPolicy } from "../types";

export interface TaxableIncomeInputs {
  /** 年度应税收入（不含年终奖，元）：应税组件 + 应税现金补贴 */
  taxableAnnualExcludingBonus: number;
  /** 年终奖（元，区间已取中值） */
  annualBonus: number;
  /** 专项附加扣除合计（元/年）：rent×12 + others */
  specialAdditionalDeductions: number;
  /** 个人五险一金年缴（元/年，税前扣除） */
  socialInsuranceDeduction: number;
}

/**
 * 年度个税双口径（年度汇算；separate 奖金÷12 找月度档 − 速算扣除数）。
 * difference = combined − separate，> 0 表示单独计税少缴。TODO(IMP-06)。
 */
export function computeAnnualTax(
  inputs: TaxableIncomeInputs,
  policy: TaxPolicy
): IncomeTaxResult {
  void inputs;
  void policy;
  throw new Error("TODO(IMP-06): computeAnnualTax 未实现");
}
