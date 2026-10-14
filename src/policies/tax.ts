import type { TaxPolicy } from '../core/types';

/**
 * 个税政策。
 * 综合所得税率表与 5000 元/月基本减除费用依据《个人所得税法》（2019 年起施行）。
 * 年终奖单独计税优惠政策已多次延期，其存续具有时效性，计算结果会附带提示。
 */
export const taxPolicy2025: TaxPolicy = {
  year: 2025,
  basicDeductionMonthly: 5000,
  annualBrackets: [
    { upTo: 36000, rate: 0.03, quickDeduction: 0 },
    { upTo: 144000, rate: 0.1, quickDeduction: 2520 },
    { upTo: 300000, rate: 0.2, quickDeduction: 16920 },
    { upTo: 420000, rate: 0.25, quickDeduction: 31920 },
    { upTo: 660000, rate: 0.3, quickDeduction: 52920 },
    { upTo: 960000, rate: 0.35, quickDeduction: 85920 },
    { upTo: null, rate: 0.45, quickDeduction: 181920 },
  ],
  specialAdditionalDeductions: {
    // 常见项目默认 0，由用户按自身情况填写（元/年）
    子女教育: 0,
    继续教育: 0,
    大病医疗: 0,
    住房贷款利息: 0,
    住房租金: 0,
    赡养老人: 0,
    婴幼儿照护: 0,
  },
  source: '《中华人民共和国个人所得税法》及实施条例；年终奖单独计税政策以当年有效文件为准。',
};
