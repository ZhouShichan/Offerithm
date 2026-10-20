import { describe, expect, it } from "vitest";
import {
  assertRegionPolicy,
  findRegionPolicy,
  getTaxPolicy,
  type SeededRegionPolicy,
} from "../index";

/** 构造最小合法地区政策(Fixture)：仅用于守卫的「坏对象」改造。 */
const validRegion: SeededRegionPolicy = {
  id: "fixture-2025",
  region: "测试市",
  year: 2025,
  effectiveFrom: "2025-07-01",
  effectiveTo: "2026-06-30",
  scope: "region",
  baseFloor: 5000,
  baseCeiling: 25000,
  hfBaseFloor: 2300,
  hfBaseCeiling: 25000,
  rates: {
    pension: { employee: 0.08, employer: 0.16, personalAccount: true },
    medical: { employee: 0.02, employer: 0.06, personalAccount: true },
    unemployment: { employee: 0.005, employer: 0.005, personalAccount: false },
    injury: { employee: 0, employer: 0.002, personalAccount: false },
    maternity: { employee: 0, employer: 0, personalAccount: false },
    housingFund: { employee: 0.12, employer: 0.12, personalAccount: true },
  },
  source: "https://example.gov.cn/fixture",
};

/** 删除一个属性，得到「缺必填项」的坏对象。 */
function omit(obj: object, key: string): Record<string, unknown> {
  const copy = { ...obj } as Record<string, unknown>;
  delete copy[key];
  return copy;
}

/* ---------------- 类型守卫(Type Guard) ---------------- */

describe("政策类型守卫", () => {
  it("接受合法对象", () => {
    expect(() => assertRegionPolicy(validRegion, "fixture.json")).not.toThrow();
  });

  it("拒绝缺 source 的对象（报错含文件名）", () => {
    const bad = omit(validRegion, "source");
    expect(() => assertRegionPolicy(bad, "no-source.json")).toThrow(
      /no-source\.json.*source|source.*no-source\.json/
    );
  });

  it("拒绝缺法定五项（如 maternity）的对象", () => {
    const bad = { ...validRegion, rates: omit(validRegion.rates, "maternity") };
    expect(() => assertRegionPolicy(bad, "no-maternity.json")).toThrow(
      /maternity/
    );
  });

  it("拒绝缺适用期（effectiveFrom/effectiveTo）的对象", () => {
    expect(() =>
      assertRegionPolicy(omit(validRegion, "effectiveFrom"), "no-from.json")
    ).toThrow(/effectiveFrom/);
    expect(() =>
      assertRegionPolicy(omit(validRegion, "effectiveTo"), "no-to.json")
    ).toThrow(/effectiveTo/);
  });

  it("拒绝非法 scope 的对象", () => {
    const bad: unknown = { ...validRegion, scope: "galaxy" };
    expect(() => assertRegionPolicy(bad, "bad-scope.json")).toThrow(/scope/);
  });
});

/* ---------------- 地区政策查找 ---------------- */

describe("findRegionPolicy", () => {
  it("北京 2025-09-01 命中 beijing-2025（城市后缀容忍，fallback=false）", () => {
    const match = findRegionPolicy("北京", "2025-09-01");
    expect(match.fallback).toBe(false);
    expect(match.policy.id).toBe("beijing-2025");
    expect(match.policy.scope).toBe("region");
    expect(match.policy.region).toBe("北京市");
  });

  it("北京 2026-08-01 命中 beijing-2026", () => {
    const match = findRegionPolicy("北京市", "2026-08-01");
    expect(match.fallback).toBe(false);
    expect(match.policy.id).toBe("beijing-2026");
  });

  it("适用期含两端：2026-06-30 仍属 beijing-2025，2026-07-01 起属 beijing-2026", () => {
    expect(findRegionPolicy("北京", "2026-06-30").policy.id).toBe(
      "beijing-2025"
    );
    expect(findRegionPolicy("北京", "2026-07-01").policy.id).toBe(
      "beijing-2026"
    );
  });

  it("广州 2025-10-01 命中 guangzhou-2025", () => {
    const match = findRegionPolicy("广州", "2025-10-01");
    expect(match.fallback).toBe(false);
    expect(match.policy.id).toBe("guangzhou-2025");
  });

  it("杭州（未覆盖城市）任意日期回退全国样例，fallback=true", () => {
    const match = findRegionPolicy("杭州", "2026-01-15");
    expect(match.fallback).toBe(true);
    expect(match.policy.id).toBe("national-sample");
    expect(match.policy.scope).toBe("national-sample");
  });
});

/* ---------------- 种子数据抽查（来源推导见各断言注释） ---------------- */

describe("种子数据抽查", () => {
  it("beijing-2025 基数与费率", () => {
    const p = findRegionPolicy("北京", "2025-09-01").policy;
    // 京人社发〔2025〕11号：2025 社保年度基数 = 2024 全口径平均工资 11937×60%=7162.2→7162、×300%=35811；
    // 公积金 2025 年度下限 2540（2025-09-01 起）、上限 35811（北京公积金中心 2025 年度通知）。
    expect(p.baseFloor).toBe(7162);
    expect(p.baseCeiling).toBe(35811);
    expect(p.hfBaseFloor).toBe(2540);
    expect(p.hfBaseCeiling).toBe(35811);
    // 养老：单位 16%（国办发〔2019〕13号）、个人 8%（国发〔2005〕38号）。
    expect(p.rates.pension?.employer).toBe(0.16);
    expect(p.rates.pension?.employee).toBe(0.08);
    // 医疗：单位 9.8%（含生育，北京市医保局咨询口径）、个人 2%（另大额互助 3 元/月在 note）。
    expect(p.rates.medical?.employer).toBe(0.098);
    expect(p.rates.medical?.employee).toBe(0.02);
    // 失业：单位 0.5% + 个人 0.5%（北京 2021 口径 + 人社部发〔2024〕40号）。
    expect(p.rates.unemployment?.employer).toBe(0.005);
    expect(p.rates.unemployment?.employee).toBe(0.005);
    // 工伤仅企业缴纳（一类基准 0.2%）；生育并入医疗不重复计缴（国办发〔2019〕10号）。
    expect(p.rates.injury?.employee).toBe(0);
    expect(p.rates.injury?.employer).toBe(0.002);
    expect(p.rates.maternity?.employer).toBe(0);
  });

  it("beijing-2026 公积金换年度、社保沿用并注明", () => {
    const p = findRegionPolicy("北京", "2026-08-01").policy;
    // 北京公积金 2026 年度通知：上限 36348、下限 2540；社保基数 2026 年度通告未出，沿用 7162/35811。
    expect(p.hfBaseCeiling).toBe(36348);
    expect(p.hfBaseFloor).toBe(2540);
    expect(p.baseFloor).toBe(7162);
    expect(p.baseCeiling).toBe(35811);
    expect(p.note).toContain("2026");
  });

  it("guangzhou-2025 费率抽查", () => {
    const p = findRegionPolicy("广州", "2025-10-01").policy;
    // 养老基数：粤人社发〔2025〕32号 5510/27549；医保基数按自然年 6236/31179（写入 medical note）。
    expect(p.baseFloor).toBe(5510);
    expect(p.baseCeiling).toBe(27549);
    // 医疗单位 6.85% = 基本医疗 6% + 生育 0.85%（穗医保规字〔2022〕1号基准；2025 自然年曾阶段性 4.5%+0.85%，见 note）。
    expect(p.rates.medical?.employer).toBe(0.0685);
    expect(p.rates.medical?.employee).toBe(0.02);
    // 失业：单位 0.8% + 个人 0.2%（粤人社函〔2023〕133号）。
    expect(p.rates.unemployment?.employer).toBe(0.008);
    expect(p.rates.unemployment?.employee).toBe(0.002);
    // 公积金：2025 年度下限 2500（最低工资）、上限 39828（2024 职工月平均工资 3 倍）。
    expect(p.hfBaseFloor).toBe(2500);
    expect(p.hfBaseCeiling).toBe(39828);
  });

  it("national-sample 携带全国口径与样例声明", () => {
    const p = findRegionPolicy("杭州", "2026-05-01").policy;
    // 全国统一口径：养老单位 16%（国办发〔2019〕13号）/个人 8%（国发〔2005〕38号）；失业总费率 1% 默认 0.5+0.5。
    expect(p.rates.pension?.employer).toBe(0.16);
    expect(p.rates.pension?.employee).toBe(0.08);
    expect(p.rates.unemployment?.employer).toBe(0.005);
    expect(p.rates.unemployment?.employee).toBe(0.005);
    expect(p.note).toContain("样例");
  });
});

/* ---------------- 个税政策 ---------------- */

describe("getTaxPolicy", () => {
  it("2025/2026 命中，2024 抛错", () => {
    expect(getTaxPolicy(2025).year).toBe(2025);
    expect(getTaxPolicy(2026).year).toBe(2026);
    expect(() => getTaxPolicy(2024)).toThrow(/2024/);
  });

  it("税率表完整（7 级、首末级与全表值按官方表推导）", () => {
    for (const year of [2025, 2026]) {
      const policy = getTaxPolicy(year);
      // 推导依据：
      // 《个人所得税法》(2018 修正) 税率表一：年度级距 36000/144000/300000/420000/660000/960000/∞，
      //   税率 3%/10%/20%/25%/30%/35%/45%；
      // 《国家税务总局公告2018年56号》按月换算后的综合所得税率表：月度级距 3000～80000（×12 即年度级距），
      //   速算扣除数(Quick Deduction) 0/210/1410/2660/4410/7160/15160。
      const expected = [
        { upTo: 36000, rate: 0.03, quickDeduction: 0 },
        { upTo: 144000, rate: 0.1, quickDeduction: 210 },
        { upTo: 300000, rate: 0.2, quickDeduction: 1410 },
        { upTo: 420000, rate: 0.25, quickDeduction: 2660 },
        { upTo: 660000, rate: 0.3, quickDeduction: 4410 },
        { upTo: 960000, rate: 0.35, quickDeduction: 7160 },
        { upTo: null, rate: 0.45, quickDeduction: 15160 },
      ];
      expect(policy.annualBrackets).toHaveLength(7);
      expect(policy.annualBrackets).toEqual(expected);
      // 基本减除：60000 元/年 ÷ 12 = 5000 元/月（个税法第六条）。
      expect(policy.basicDeductionMonthly).toBe(5000);
      // 租金三档：1500/1100/800 元/月（国发〔2018〕41号第十七条；2026 仍按三档，上海税务 2026-03 问答）。
      expect(policy.rentDeductionTiers).toEqual({
        majorCity: 1500,
        largeCity: 1100,
        other: 800,
      });
      // 年终奖(Annual Bonus)单独计税(Separate Taxation)效期至 2027-12-31（财政部 税务总局公告2023年30号）。
      expect(policy.note).toContain("2027-12-31");
    }
  });
});
