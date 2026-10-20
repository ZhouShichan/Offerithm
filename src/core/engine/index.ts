import type { Offer, OfferCalcResult, RegionPolicy, TaxPolicy } from "../types";
import { resolveSalary } from "./salary";
import { computeInsurance } from "./insurance";
import { computeAnnualTax } from "./tax";

export { resolveSalary, computeInsurance, computeAnnualTax };
export { compareOffers, defaultWeights, criterionLabels } from "./compare";
export type { ResolvedSalary } from "./salary";
export type { InsuranceResult } from "./insurance";
export type { TaxableIncomeInputs } from "./tax";
export type { CompareEntry } from "./compare";

/** calculateOffer 注入的政策对象（引擎不读政策文件，保持纯函数）。 */
export interface CalcPolicies {
  region: RegionPolicy;
  tax: TaxPolicy;
}

/**
 * 单个 Offer 全量计算：薪资归一 → 社保 → 个税双口径 → 双储蓄口径。
 * 政策查找/回退由调用方完成并注入；规格见 issue #11。TODO(IMP-07)。
 */
export function calculateOffer(
  offer: Offer,
  policies: CalcPolicies
): OfferCalcResult {
  void offer;
  void policies;
  throw new Error("TODO(IMP-07): calculateOffer 未实现");
}
