import type { Offer } from './types';
import { calculateOffer } from './engine';
import { findPolicy } from '../policies/regions';

/** Runtime validation shared by forms, drafts and imported snapshots. */
export interface ValidationIssue { path: string; message: string }
export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}
type Mode = 'complete' | 'draft';
type Check = (value: unknown, path: string) => void;

export function validateOffer(value: unknown, mode: Mode = 'complete'): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  const object = (v: unknown, p: string, fields: Record<string, Check>) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) { fail(p, '必须是对象'); return; }
    const obj = v as Record<string, unknown>;
    for (const [key, check] of Object.entries(fields)) {
      const path = p ? `${p}.${key}` : key;
      if (!(key in obj) || obj[key] === undefined) { if (mode === 'complete') fail(path, '必填'); }
      else check(obj[key], path);
    }
  };
  const string = (required = false): Check => (v, p) => { if (typeof v !== 'string' || (required && mode === 'complete' && !v.trim())) fail(p, '请输入有效文本'); };
  const date: Check = (v, p) => { if (!isIsoDateTime(v)) fail(p, '请输入有效 ISO 日期'); };
  const number = (min = 0, max = Number.MAX_VALUE, exclusive = false): Check => (v, p) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || (exclusive ? v <= min : v < min) || v > max) fail(p, '数值超出有效范围');
  };
  const boolean: Check = (v, p) => { if (typeof v !== 'boolean') fail(p, '必须是布尔值'); };
  const choice = (...options: string[]): Check => (v, p) => { if (typeof v !== 'string' || !options.includes(v)) fail(p, '选项无效'); };
  const array = (check: Check): Check => (v, p) => { if (!Array.isArray(v)) fail(p, '必须是数组'); else for (let i = 0; i < v.length; i++) check(v[i], `${p}.${i}`); };
  const component: Check = (v, p) => object(v, p, { id: string(true), name: string(true), frequency: choice('monthly', 'quarterly', 'annual', 'oneTime'), amountType: choice('fixed', 'percentOfBase'), amount: number(), countsTowardInsuranceBase: boolean, taxable: boolean });
  const tier: Check = (v, p) => object(v, p, { upTo: (x, q) => { if (x !== null) number(0, Number.MAX_VALUE, true)(x, q); }, rate: number() });
  const rule: Check = (v, p) => {
    object(v, p, { id: string(true), name: string(true), base: choice('monthlyBase', 'annualBase'), tiers: array(tier) });
    if (typeof v === 'object' && v !== null && 'tiers' in v && Array.isArray(v.tiers)) {
      let previous = 0;
      const tiers = v.tiers;
      tiers.forEach((t: unknown, i: number) => {
        if (typeof t !== 'object' || t === null || !('upTo' in t)) return;
        const upper = t.upTo;
        if (upper === null) { if (i !== tiers.length - 1) fail(`${p}.tiers.${i}.upTo`, '无限上限只能位于最后'); }
        else if (typeof upper === 'number' && Number.isFinite(upper)) { if (upper <= previous) fail(`${p}.tiers.${i}.upTo`, '上限必须递增'); previous = upper; }
      });
    }
  };
  const uniqueIds = (check: Check): Check => (v, p) => {
    array(check)(v, p);
    if (!Array.isArray(v)) return;
    const seen = new Set<string>();
    v.forEach((item: unknown, i) => {
      if (typeof item !== 'object' || item === null || !('id' in item) || typeof item.id !== 'string' || !item.id) return;
      if (seen.has(item.id)) fail(`${p}.${i}.id`, 'ID 重复');
      seen.add(item.id);
    });
  };
  const scenario: Check = (v, p) => object(v, p, { raiseRate: number(-1), bonusMultiplier: number() });
  object(value, '', {
    id: (v, p) => { if (typeof v !== 'string' || !v.trim()) fail(p, '请输入有效 ID'); }, name: string(true), companyName: string(), regionPolicyId: string(true),
    salary: (v, p) => object(v, p, { baseMonthly: number(), annualBonus: number(), bonusTaxMethod: choice('separate', 'combined'), components: uniqueIds(component), tieredBonusRules: uniqueIds(rule) }),
    scenarios: (v, p) => object(v, p, { pessimistic: scenario, base: scenario, optimistic: scenario }),
    livingCost: (v, p) => object(v, p, { housing: number(), food: number(), transport: number(), utilities: number(), other: number(), annualExtra: number() }),
    work: (v, p) => object(v, p, { weeklyHours: number(0, 168, true), commuteMinutesOneWay: number(0, 1440), travelDaysPerMonth: number(0, 31), annualLeaveDays: number(0, 365) }),
    oneTimePayments: array((v, p) => object(v, p, { name: string(true), amount: number(), taxable: boolean })),
    createdAt: date, updatedAt: date,
    ...(typeof value === 'object' && value !== null && 'notes' in value && value.notes !== undefined ? { notes: string() } : {}),
  });
  if (mode === 'draft' && typeof value === 'object' && value !== null && !('id' in value)) fail('id', '必填');
  if (mode === 'complete' && issues.length === 0) {
    const offer = value as Offer;
    if (!findPolicy(offer.regionPolicyId)) fail('regionPolicyId', '未找到地区政策');
    else {
      const allFinite = (v: unknown): boolean => typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(allFinite) : typeof v === 'object' && v !== null ? Object.values(v).every(allFinite) : true;
      for (const scenario of ['pessimistic', 'base', 'optimistic'] as const) {
        if (!allFinite(calculateOffer(offer, { scenario }))) { fail('scenarios.' + scenario, '输入导致计算结果超出有效范围'); }
      }
    }
  }
  return issues;
}
