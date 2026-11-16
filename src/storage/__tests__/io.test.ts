import { describe, expect, it } from 'vitest';
import { fromJson } from '../io';

describe('JSON import validation', () => {
  it('rejects unsupported versions and malformed nested data', () => {
    expect(() => fromJson(JSON.stringify({ app: 'offerithm', version: 2, offers: [] }))).toThrow();
    expect(() => fromJson(JSON.stringify({ app: 'offerithm', version: 1, exportedAt: '2025-01-01T00:00:00Z', offers: [{ id: 'a' }] }))).toThrow();
  });
});

import { makeOffer } from '../../../tests/browser/fixtures';
import { toJson } from '../io';

const snapshot = (offers = [makeOffer('a')]) => ({ app: 'offerithm' as const, version: 1 as const, exportedAt: '2026-01-01T00:00:00.000Z', offers });
it('round trips complete version 1 snapshots', () => {
  const source = snapshot();
  expect(fromJson(toJson(source))).toEqual(source);
});
it('rejects duplicate IDs and an invalid later record', () => {
  expect(() => fromJson(JSON.stringify(snapshot([makeOffer('a'), makeOffer('a')])))).toThrow(/重复/);
  expect(() => fromJson(JSON.stringify({ ...snapshot(), offers: [makeOffer('a'), { ...makeOffer('b'), salary: null }] }))).toThrow(/salary/);
});
it('rejects invalid export dates', () => {
  expect(() => fromJson(JSON.stringify({ ...snapshot(), exportedAt: '2025-02-30T00:00:00Z' }))).toThrow();
});
it('rejects oversized snapshots before validation', () => {
  expect(() => fromJson(' '.repeat(5 * 1024 * 1024 + 1))).toThrow(/大小/);
  expect(() => fromJson(JSON.stringify(snapshot(Array.from({ length: 1001 }, (_, i) => makeOffer(String(i))))))).toThrow(/数量/);
});
