import type { SalaryInput } from "../types";

/**
 * 归一后的薪资形态（规格见 issue #11 决议）。
 * monthlyFixedBase = 月频固定组件合计；annualGross = 参与计算的年度税前现金
 * （已按对账依据取值）；bonusAnnual = 奖金规则年值（区间取中值）。
 */
export interface ResolvedSalary {
  monthlyFixedBase: number;
  annualGross: number;
  bonusAnnual: number;
  /** 无明细模式下的缴费基数缺省（年化 ÷ 12 或 baseMonthly，标 system-estimate） */
  insuranceBaseDefault: number;
  /** 仅 custom 模式填了总包基准且不一致时存在 */
  reconciliation?: {
    baseline: number;
    detailTotal: number;
    diff: number;
    basis: "package" | "detail";
  };
}

/** 三模式归一（annualPackage / monthlyTimesMonths / custom）。TODO(IMP-04)。 */
export function resolveSalary(input: SalaryInput): ResolvedSalary {
  void input;
  throw new Error("TODO(IMP-04): resolveSalary 未实现");
}
