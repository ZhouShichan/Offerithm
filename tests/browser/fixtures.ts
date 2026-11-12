import type { Offer } from '../../src/core/types';

export function makeOffer(id: string, baseMonthly = 10000): Offer {
  return {
    id,
    name: `Offer ${id.toUpperCase()}`,
    companyName: `Company ${id.toUpperCase()}`,
    regionPolicyId: 'bj-2025-example',
    salary: { baseMonthly, annualBonus: 0, bonusTaxMethod: 'combined', components: [], tieredBonusRules: [] },
    scenarios: {
      pessimistic: { raiseRate: 0.02, bonusMultiplier: 0.5 },
      base: { raiseRate: 0.05, bonusMultiplier: 1 },
      optimistic: { raiseRate: 0.1, bonusMultiplier: 1.5 },
    },
    livingCost: { housing: 0, food: 0, transport: 0, utilities: 0, other: 0, annualExtra: 0 },
    work: { weeklyHours: 40, commuteMinutesOneWay: 30, travelDaysPerMonth: 0, annualLeaveDays: 5 },
    oneTimePayments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
