import { describe, expect, it } from 'vitest';
import { validateOffer } from '../validation';
import { makeOffer } from '../../../tests/browser/fixtures';

describe('validation independent boundary review', () => {
  it('accepts negative growth down to a complete loss and rejects a rate below it', () => {
    const offer = makeOffer('negative-growth');
    offer.scenarios.pessimistic.raiseRate = -0.2;
    offer.scenarios.base.raiseRate = -1;
    expect(validateOffer(offer)).toEqual([]);
    offer.scenarios.base.raiseRate = -1.01;
    expect(validateOffer(offer).map(issue => issue.path)).toContain('scenarios.base.raiseRate');
  });

  it('rejects finite amounts whose annualized calculation overflows', () => {
    const offer = makeOffer('huge', Number.MAX_VALUE);
    expect(validateOffer(offer).length).toBeGreaterThan(0);
  });

  it('rejects an invalid calendar date instead of normalizing it into March', () => {
    const offer = makeOffer('bad-date');
    offer.createdAt = '2025-02-30T00:00:00.000Z';
    expect(validateOffer(offer).map(issue => issue.path)).toContain('createdAt');
  });

  it('keeps a partial draft distinct from a complete calculable offer', () => {
    const draft = { id: 'partial', name: 'Unfinished', salary: { baseMonthly: 10000 } };
    expect(validateOffer(draft, 'draft')).toEqual([]);
    expect(validateOffer(draft).map(issue => issue.path)).toEqual(expect.arrayContaining(['salary.annualBonus', 'livingCost', 'work']));
  });

  it('diagnoses a sparse stored component array without throwing during calculation', () => {
    const offer = makeOffer('sparse');
    offer.salary.components = new Array(1);
    expect(() => validateOffer(offer)).not.toThrow();
    expect(validateOffer(offer).length).toBeGreaterThan(0);
  });

  it('preserves historically calculable tier rates above one', () => {
    const offer = makeOffer('large-tier-rate');
    offer.salary.tieredBonusRules = [{ id: 'tier', name: 'Tier', base: 'monthlyBase', tiers: [{ upTo: null, rate: 2 }] }];
    expect(validateOffer(offer)).toEqual([]);
  });

  it('requires a stable nonempty ID even for an incomplete draft', () => {
    for (const draft of [{ name: 'Missing ID' }, { id: '' }, { id: '   ' }]) {
      expect(validateOffer(draft, 'draft').map(issue => issue.path)).toContain('id');
    }
  });
});
