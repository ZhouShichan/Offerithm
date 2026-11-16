import { expect, test } from '@playwright/test';
import { makeOffer } from './fixtures';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('a successful request followed by abort rejects and leaves no record', async ({ page }) => {
  const outcome = await page.evaluate(async (offer) => {
    const path = '/src/storage/db.ts';
    const { offerStore } = await import(path);
    const originalPut = IDBObjectStore.prototype.put;
    let requestSucceeded = false;
    IDBObjectStore.prototype.put = function (...args) {
      const request = originalPut.apply(this, args);
      request.addEventListener('success', () => {
        requestSucceeded = true;
        this.transaction.abort();
      }, { once: true });
      return request;
    };
    let rejected = false;
    try { await offerStore.put(offer); } catch { rejected = true; }
    finally { IDBObjectStore.prototype.put = originalPut; }
    return { requestSucceeded, rejected, stored: await offerStore.get(offer.id) };
  }, makeOffer('aborted'));
  expect(outcome).toEqual({ requestSucceeded: true, rejected: true, stored: undefined });
});

test('put resolves after complete and supports persisted CRUD and drafts', async ({ page }) => {
  const outcome = await page.evaluate(async (offer) => {
    const path = '/src/storage/db.ts';
    const { offerStore, draftStore } = await import(path);
    const events: string[] = [];
    const originalTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = originalTransaction.apply(this, args);
      tx.addEventListener('complete', () => events.push('complete'), { once: true });
      return tx;
    };
    let key;
    try {
      key = await offerStore.put(offer);
      events.push('resolved');
    } finally { IDBDatabase.prototype.transaction = originalTransaction; }
    const stored = await offerStore.get(offer.id);
    await draftStore.put(offer);
    const drafts = await draftStore.list();
    await draftStore.remove(offer.id);
    await offerStore.remove(offer.id);
    return { events, key, stored, drafts, offersAfterDelete: await offerStore.list(), draftsAfterDelete: await draftStore.list() };
  }, makeOffer('saved'));
  expect(outcome.events).toEqual(['complete', 'resolved']);
  expect(outcome.key).toBe('saved');
  expect(outcome.stored).toEqual(makeOffer('saved'));
  expect(outcome.drafts).toEqual([makeOffer('saved')]);
  expect(outcome.offersAfterDelete).toEqual([]);
  expect(outcome.draftsAfterDelete).toEqual([]);
});

test('a synchronous invalid-key error rejects without blocking later writes', async ({ page }) => {
  const outcome = await page.evaluate(async (offer) => {
    const path = '/src/storage/db.ts';
    const { offerStore } = await import(path);
    let rejected = false;
    try { await offerStore.put({ name: 'missing id' }); } catch { rejected = true; }
    await offerStore.put(offer);
    return { rejected, stored: await offerStore.get(offer.id) };
  }, makeOffer('retry'));
  expect(outcome).toEqual({ rejected: true, stored: makeOffer('retry') });
});
test('saving clears draft atomically and import detects intervening writes', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (offer) => {
    const path = '/src/storage/db.ts';
    const { offerStore, draftStore, prepareImport, commitImport } = await import(path);
    await draftStore.put(offer);
    await offerStore.save(offer);
    const draft = await draftStore.get(offer.id);
    const incoming = { ...offer, name: 'imported' };
    const preview = await prepareImport([incoming]);
    await offerStore.put({ ...offer, name: 'changed' });
    let rejected = false;
    try { await commitImport(preview); } catch { rejected = true; }
    return { draft, rejected, stored: await offerStore.get(offer.id) };
  }, makeOffer('p1'));
  expect(result.draft).toBeUndefined();
  expect(result.rejected).toBe(true);
  expect(result.stored.name).toBe('changed');
});
