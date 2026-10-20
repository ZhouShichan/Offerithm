/**
 * 政策数据注册表(Policy Registry)。
 * - 种子 JSON 只在本模块导入；引擎/页面经 `findRegionPolicy` / `getTaxPolicy` 取用。
 * - 加载即校验（fail-fast）：缺 source、缺法定五项、缺适用期、scope 非法等
 *   在模块加载期抛错（#10 决议：不把坏数据带进运行时）。
 * - 诚信原则：无可核实官方来源的数据不得进种子（`src/policies/README.md`）。
 */
import type { InsuranceItemKey, RegionPolicy, TaxPolicy } from "../core/types";
import nationalSample from "./regions/national-sample.json";
import beijing2025 from "./regions/beijing-2025.json";
import beijing2026 from "./regions/beijing-2026.json";
import guangzhou2025 from "./regions/guangzhou-2025.json";
import tax2025 from "./tax/2025.json";
import tax2026 from "./tax/2026.json";

/**
 * 种子政策文件：在契约字段之外允许携带文件级 `note`（时效/适用条件声明，
 * 供 UI 展示；契约类型见 `src/core/types.ts` 的 RegionPolicy / TaxPolicy）。
 */
export type SeededRegionPolicy = RegionPolicy & { note?: string };
export type SeededTaxPolicy = TaxPolicy & { note?: string };

/** 法定五项：地区政策必须齐备的险种（缺一即坏数据）。 */
const MANDATORY_INSURANCE_ITEMS: readonly InsuranceItemKey[] = [
  "pension",
  "medical",
  "unemployment",
  "injury",
  "maternity",
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fail(fileName: string, reason: string): never {
  throw new Error(`[policies] ${fileName}: ${reason}`);
}

/** 地区政策类型守卫(Type Guard)：校验失败抛错（错误信息含文件名）。 */
export function assertRegionPolicy(
  data: unknown,
  fileName: string
): asserts data is SeededRegionPolicy {
  if (!isRecord(data)) fail(fileName, "政策必须是 JSON 对象");

  for (const key of ["id", "region", "source"] as const) {
    if (!isNonEmptyString(data[key])) fail(fileName, `缺少必填字符串字段 ${key}`);
  }
  const { effectiveFrom, effectiveTo } = data;
  if (!isNonEmptyString(effectiveFrom) || !ISO_DATE_RE.test(effectiveFrom)) {
    fail(fileName, "缺少或非法适用期字段 effectiveFrom（须为 ISO 日期 YYYY-MM-DD）");
  }
  if (!isNonEmptyString(effectiveTo) || !ISO_DATE_RE.test(effectiveTo)) {
    fail(fileName, "缺少或非法适用期字段 effectiveTo（须为 ISO 日期 YYYY-MM-DD）");
  }
  if (effectiveFrom > effectiveTo) {
    fail(fileName, "effectiveFrom 不得晚于 effectiveTo");
  }
  if (!isFiniteNumber(data.year) || !Number.isInteger(data.year)) {
    fail(fileName, "缺少或非法 year");
  }
  if (data.scope !== "region" && data.scope !== "national-sample") {
    fail(fileName, `scope 非法：${String(data.scope)}（只允许 region | national-sample）`);
  }
  const { baseFloor, baseCeiling, hfBaseFloor, hfBaseCeiling } = data;
  if (
    !isFiniteNumber(baseFloor) ||
    !isFiniteNumber(baseCeiling) ||
    !isFiniteNumber(hfBaseFloor) ||
    !isFiniteNumber(hfBaseCeiling)
  ) {
    fail(fileName, "缺少或非法基数数值字段（baseFloor/baseCeiling/hfBaseFloor/hfBaseCeiling）");
  }
  if (baseFloor > baseCeiling || hfBaseFloor > hfBaseCeiling) {
    fail(fileName, "基数下限不得高于上限");
  }

  const rates = data.rates;
  if (!isRecord(rates)) fail(fileName, "缺少 rates 对象");
  for (const item of MANDATORY_INSURANCE_ITEMS) {
    if (!isRecord(rates[item])) {
      fail(fileName, `法定险种 ${item} 缺失（法定五项必须齐备）`);
    }
  }
  for (const key of Object.keys(rates)) {
    const rate = rates[key];
    if (!isRecord(rate)) fail(fileName, `险种 ${key} 条目必须是对象`);
    if (
      !isFiniteNumber(rate.employee) ||
      !isFiniteNumber(rate.employer) ||
      typeof rate.personalAccount !== "boolean"
    ) {
      fail(fileName, `险种 ${key} 的 employee/employer/personalAccount 非法`);
    }
    if (rate.employee < 0 || rate.employer < 0) {
      fail(fileName, `险种 ${key} 费率不得为负`);
    }
  }
}

/** 个税政策类型守卫：校验失败抛错（错误信息含文件名）。 */
export function assertTaxPolicy(
  data: unknown,
  fileName: string
): asserts data is SeededTaxPolicy {
  if (!isRecord(data)) fail(fileName, "政策必须是 JSON 对象");
  if (!isFiniteNumber(data.year) || !Number.isInteger(data.year)) {
    fail(fileName, "缺少或非法 year");
  }
  if (!isNonEmptyString(data.source)) fail(fileName, "缺少必填字符串字段 source");
  if (!isFiniteNumber(data.basicDeductionMonthly)) {
    fail(fileName, "缺少或非法 basicDeductionMonthly");
  }

  const brackets = data.annualBrackets;
  if (!Array.isArray(brackets) || brackets.length === 0) {
    fail(fileName, "annualBrackets 必须为非空数组");
  }
  let prevUpTo = -Infinity;
  for (const [index, bracket] of brackets.entries()) {
    if (!isRecord(bracket)) fail(fileName, `第 ${index + 1} 级必须是对象`);
    const { upTo, rate, quickDeduction } = bracket;
    if (upTo !== null && !isFiniteNumber(upTo)) {
      fail(fileName, `第 ${index + 1} 级 upTo 非法（数字或 null）`);
    }
    if (!isFiniteNumber(rate) || rate <= 0 || rate > 1) {
      fail(fileName, `第 ${index + 1} 级 rate 非法（须为 (0,1] 的小数）`);
    }
    if (!isFiniteNumber(quickDeduction) || quickDeduction < 0) {
      fail(fileName, `第 ${index + 1} 级 quickDeduction 非法（须为 ≥0）`);
    }
    const limit = upTo ?? Number.POSITIVE_INFINITY;
    if (limit <= prevUpTo) {
      fail(fileName, `第 ${index + 1} 级级距未严格递增`);
    }
    prevUpTo = limit;
  }
  const last = brackets[brackets.length - 1];
  if (isRecord(last) && last.upTo !== null) {
    fail(fileName, "末级 upTo 必须为 null（开放区间）");
  }

  const tiers = data.rentDeductionTiers;
  if (tiers !== undefined) {
    if (
      !isRecord(tiers) ||
      !isFiniteNumber(tiers.majorCity) ||
      !isFiniteNumber(tiers.largeCity) ||
      !isFiniteNumber(tiers.other)
    ) {
      fail(fileName, "rentDeductionTiers 非法（三档均须为数值）");
    }
  }
}

/* ---------------- 加载种子并校验 ---------------- */

const regionFileEntries: ReadonlyArray<{ fileName: string; data: unknown }> = [
  { fileName: "regions/national-sample.json", data: nationalSample },
  { fileName: "regions/beijing-2025.json", data: beijing2025 },
  { fileName: "regions/beijing-2026.json", data: beijing2026 },
  { fileName: "regions/guangzhou-2025.json", data: guangzhou2025 },
];

const taxFileEntries: ReadonlyArray<{ fileName: string; data: unknown }> = [
  { fileName: "tax/2025.json", data: tax2025 },
  { fileName: "tax/2026.json", data: tax2026 },
];

const regionPolicies: SeededRegionPolicy[] = [];
for (const { fileName, data } of regionFileEntries) {
  assertRegionPolicy(data, fileName);
  regionPolicies.push(data);
}
if (regionPolicies.filter((p) => p.scope === "national-sample").length !== 1) {
  throw new Error(
    "[policies] regions/: 必须恰好包含一个 national-sample 回退配置"
  );
}

const taxPolicies: SeededTaxPolicy[] = [];
for (const { fileName, data } of taxFileEntries) {
  assertTaxPolicy(data, fileName);
  taxPolicies.push(data);
}

/** 全部已校验的地区政策（含全国样例）。 */
export const allRegionPolicies: readonly SeededRegionPolicy[] = regionPolicies;

/** 全部已校验的个税政策。 */
export const allTaxPolicies: readonly SeededTaxPolicy[] = taxPolicies;

/* ---------------- 查找 ---------------- */

/** 地区政策查找结果：`fallback=true` 表示未命中城市政策，回退全国样例(National Sample)。 */
export interface RegionPolicyMatch {
  policy: SeededRegionPolicy;
  fallback: boolean;
}

/** 城市名匹配：容忍行政后缀差异（「北京」↔「北京市」）。 */
function regionMatches(stored: string, query: string): boolean {
  const s = stored.trim();
  const q = query.trim();
  if (s.length === 0 || q.length === 0) return false;
  return s === q || s.startsWith(q) || q.startsWith(s);
}

/**
 * 按地区 + 日期（ISO 8601，含两端）查找政策：
 * - 仅参与匹配 `scope: "region"` 的城市政策；
 * - 多个命中时取 effectiveFrom 最新者；
 * - 无命中（含日期落在空档）回退全国样例并置 `fallback: true`（调用方须给出
 *   policy-missing-fallback 警告与低置信度，见 issue #11 决议）。
 */
export function findRegionPolicy(
  region: string,
  dateISO: string
): RegionPolicyMatch {
  if (!ISO_DATE_RE.test(dateISO)) {
    throw new Error(
      `[policies] findRegionPolicy: dateISO 须为 ISO 日期 YYYY-MM-DD，收到 ${dateISO}`
    );
  }
  const nationalSample = regionPolicies.find(
    (p) => p.scope === "national-sample"
  );
  if (!nationalSample) {
    throw new Error("[policies] regions/: 缺少 national-sample 回退配置");
  }

  const hits = regionPolicies.filter(
    (p) =>
      p.scope === "region" &&
      regionMatches(p.region, region) &&
      p.effectiveFrom <= dateISO &&
      dateISO <= p.effectiveTo
  );
  if (hits.length === 0) return { policy: nationalSample, fallback: true };

  const latest = hits.reduce((a, b) =>
    b.effectiveFrom > a.effectiveFrom ? b : a
  );
  return { policy: latest, fallback: false };
}

/** 按年度取个税政策；无该年文件即抛错（个税无回退样例）。 */
export function getTaxPolicy(year: number): SeededTaxPolicy {
  const found = taxPolicies.find((p) => p.year === year);
  if (!found) {
    throw new Error(`[policies] tax/: 缺少 ${year} 年度个税政策文件`);
  }
  return found;
}
