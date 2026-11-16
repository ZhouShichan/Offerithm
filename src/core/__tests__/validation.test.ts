import { describe, expect, it } from 'vitest';
import { validateOffer } from '../validation';

const valid = {
  id: 'a', name: 'Offer', companyName: '', regionPolicyId: 'bj-2025-example',
  salary: { baseMonthly: 10000, annualBonus: 0, bonusTaxMethod: 'separate', components: [], tieredBonusRules: [] },
  scenarios: Object.fromEntries(['pessimistic', 'base', 'optimistic'].map(k => [k, { raiseRate: 0, bonusMultiplier: 1 }])),
  livingCost: { housing: 0, food: 0, transport: 0, utilities: 0, other: 0, annualExtra: 0 },
  work: { weeklyHours: 40, commuteMinutesOneWay: 0, travelDaysPerMonth: 0, annualLeaveDays: 5 },
  oneTimePayments: [], createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
};
describe('offer validation', () => {
  it('accepts a complete offer and incomplete safe drafts', () => {
    expect(validateOffer(valid)).toEqual([]);
    expect(validateOffer({ id: 'a', salary: { baseMonthly: 0 } }, 'draft')).toEqual([]);
  });
  it('reports nested invalid fields with paths', () => {
    const issues = validateOffer({ ...valid, salary: { ...valid.salary, components: [{ id: 'x', name: 'x', frequency: 'bad', amountType: 'fixed', amount: Infinity, taxable: true, countsTowardInsuranceBase: true }] }, work: { ...valid.work, weeklyHours: 0 } });
    expect(issues.map(i => i.path)).toEqual(expect.arrayContaining(['salary.components.0.frequency', 'salary.components.0.amount', 'work.weeklyHours']));
  });
  it('rejects malformed nested draft values', () => {
    expect(validateOffer({ salary: null }, 'draft').map(i => i.path)).toContain('salary');
  });
  it('rejects unknown regions and overflowing calculations while allowing blank drafts', () => {
    expect(validateOffer({ ...valid, regionPolicyId: 'unknown' }).map(i => i.path)).toContain('regionPolicyId');
    expect(validateOffer({ ...valid, salary: { ...valid.salary, baseMonthly: Number.MAX_VALUE } }).length).toBeGreaterThan(0);
    expect(validateOffer({ id: 'a', name: '' }, 'draft')).toEqual([]);
  });
  it('rejects missing nested fields and invalid tier ordering', () => {
    const partial = { ...valid, salary: { ...valid.salary, components: [{ id: 'c' }], tieredBonusRules: [{ id: 'r', name: 'r', base: 'monthlyBase', tiers: [{ upTo: 10, rate: 0.1 }, { upTo: 5, rate: 0.2 }] }] } };
    const paths = validateOffer(partial).map(i => i.path);
    expect(paths).toContain('salary.components.0.frequency');
    expect(paths).toContain('salary.tieredBonusRules.0.tiers.1.upTo');
  });

  it('rejects duplicate IDs in salary components and bonus rules', () => {
    const component = { id: 'c', name: 'x', frequency: 'monthly', amountType: 'fixed', amount: 1, taxable: true, countsTowardInsuranceBase: true };
    const rule = { id: 'r', name: 'r', base: 'monthlyBase', tiers: [{ upTo: null, rate: 0.1 }] };
    const issues = validateOffer({ ...valid, salary: { ...valid.salary, components: [component, component], tieredBonusRules: [rule, rule] } });
    expect(issues.map(i => i.path)).toEqual(expect.arrayContaining(['salary.components.1.id', 'salary.tieredBonusRules.1.id']));
  });

  it('rejects a blank draft identity while permitting blank editable names', () => {
    expect(validateOffer({ id: '', name: '' }, 'draft').map(i => i.path)).toContain('id');
  });

  it('accepts undefined optional notes and rejects null', () => {
    expect(validateOffer({ ...valid, notes: undefined })).toEqual([]);
    expect(validateOffer({ ...valid, notes: null }).map(i => i.path)).toContain('notes');
  });

});
