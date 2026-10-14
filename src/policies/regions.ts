import type { RegionPolicy } from '../core/types';

/**
 * 地区政策注册表。
 * 重要原则：所有比例与基数上下限必须附 source，可追溯到官方发布；
 * 未核实的值一律不写入。当前仅提供少量示例（标注为 example），
 * 其余地区由用户在设置页自行配置并保存到本地 IndexedDB。
 */
export const regionPolicies: RegionPolicy[] = [
  {
    id: 'bj-2025-example',
    region: '北京市',
    year: 2025,
    baseFloor: 6821,
    baseCeiling: 35283,
    hfBaseFloor: 2420,
    hfBaseCeiling: 35283,
    rates: {
      pension: { employee: 0.08, employer: 0.16, personalAccount: true },
      medical: {
        employee: 0.02,
        employer: 0.09,
        personalAccount: true,
        extraEmployee: 3, // 大额医疗互助 3 元/月
      },
      unemployment: { employee: 0.005, employer: 0.005, personalAccount: false },
      injury: { employee: 0, employer: 0.004, personalAccount: false }, // 行业浮动
      maternity: { employee: 0, employer: 0.008, personalAccount: false },
      housingFund: {
        employee: 0.12,
        employer: 0.12,
        personalAccount: true,
        note: '比例区间 5%-12%，常见为 12%',
      },
    },
    source: '示例配置：数值参考近年公开报道，正式使用前请以北京市人社局当年公布口径为准。',
  },
  {
    id: 'sh-2025-example',
    region: '上海市',
    year: 2025,
    baseFloor: 7384,
    baseCeiling: 36921,
    hfBaseFloor: 2690,
    hfBaseCeiling: 36921,
    rates: {
      pension: { employee: 0.08, employer: 0.16, personalAccount: true },
      medical: { employee: 0.02, employer: 0.09, personalAccount: true },
      unemployment: { employee: 0.005, employer: 0.005, personalAccount: false },
      injury: { employee: 0, employer: 0.0026, personalAccount: false },
      maternity: { employee: 0, employer: 0.01, personalAccount: false },
      housingFund: {
        employee: 0.07,
        employer: 0.07,
        personalAccount: true,
        note: '比例区间 5%-7%，常见为 7%',
      },
      supplementaryHousingFund: { employee: 0.05, employer: 0.05, personalAccount: true },
    },
    source: '示例配置：数值参考近年公开报道，正式使用前请以上海市人社局当年公布口径为准。',
  },
];

export function findPolicy(id: string): RegionPolicy | undefined {
  return regionPolicies.find((p) => p.id === id);
}
