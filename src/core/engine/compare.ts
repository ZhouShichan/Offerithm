import type { ComparisonResult, ComparisonWeights, Criterion } from "../types";

/** 六维全受益方向（#8 决议）；主观维度由工作区评分提供（0-100，可空=缺失）。 */
export interface CompareEntry {
  offerId: string;
  name: string;
  netAnnualCash: number;
  cashSavingsAnnual: number;
  ratings: Partial<Record<Criterion, number>>;
}

/**
 * 加权比较：min-max 归一 0-100（集合内相对）+ 缺失剔除有效权重再归一 + 1224 排名。
 * 算法规格见 issue #8 决议。TODO(IMP-12)。
 */
export function compareOffers(
  entries: CompareEntry[],
  weights: ComparisonWeights
): ComparisonResult[] {
  void entries;
  void weights;
  throw new Error("TODO(IMP-12): compareOffers 未实现");
}

/** 默认权重：六维均等（#8 决议）。 */
export const defaultWeights: ComparisonWeights = {
  netCash: 50,
  savings: 50,
  workLifeBalance: 50,
  growth: 50,
  stability: 50,
  benefits: 50,
};

export const criterionLabels: Record<Criterion, string> = {
  netCash: "税后现金",
  savings: "现金储蓄",
  workLifeBalance: "工作生活平衡",
  growth: "成长性",
  stability: "稳定性",
  benefits: "福利",
};
