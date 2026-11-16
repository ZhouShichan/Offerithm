import { expect, test } from '@playwright/test';
import { makeOffer } from './fixtures';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('a synchronous failure on the last import write rolls back earlier replacements', async ({ page }) => {
  const original = makeOffer('existing');
  const incoming = [{ ...original, name: 'Replacement' }, makeOffer('last')];
  const outcome = await page.evaluate(async ({ original, incoming }) => {
    const path = '/src/storage/db.ts';
    const { offerStore, prepareImport, commitImport } = await import(path);
    await offerStore.put(original);
    const preview = await prepareImport(incoming);
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'offers' && args[0].id === 'last') {
        throw new DOMException('Injected last-write failure', 'DataCloneError');
      }
      return originalPut.apply(this, args);
    };
    let rejected = false;
    const pageErrors: string[] = [];
    const suppressExpected = (event: ErrorEvent) => {
      pageErrors.push(event.message);
      event.preventDefault();
    };
    window.addEventListener('error', suppressExpected);
    try { await commitImport(preview); } catch { rejected = true; }
    finally {
      IDBObjectStore.prototype.put = originalPut;
      window.removeEventListener('error', suppressExpected);
    }
    return { rejected, records: await offerStore.list(), pageErrors };
  }, { original, incoming });
  expect(outcome.rejected).toBe(true);
  expect(outcome.records).toEqual([original]);
  expect(outcome.pageErrors).toEqual([]);
});

test('a failed draft cleanup rolls back the formal replacement and keeps the draft', async ({ page }) => {
  const original = makeOffer('same');
  const draft = { ...original, name: 'Draft to retain' };
  const outcome = await page.evaluate(async ({ original, draft }) => {
    const path = '/src/storage/db.ts';
    const { offerStore, draftStore } = await import(path);
    await offerStore.put(original);
    await draftStore.put(draft);
    const originalDelete = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (...args) {
      if (this.name === 'drafts') throw new DOMException('Injected cleanup failure', 'UnknownError');
      return originalDelete.apply(this, args);
    };
    let rejected = false;
    try { await offerStore.save({ ...draft, name: 'Attempted formal replacement' }); }
    catch { rejected = true; }
    finally { IDBObjectStore.prototype.delete = originalDelete; }
    return { rejected, formal: await offerStore.get(original.id), draft: await draftStore.get(original.id) };
  }, { original, draft });
  expect(outcome).toEqual({ rejected: true, formal: original, draft });
});

test('an import preview rejects a changed target without changing any other incoming record', async ({ page }) => {
  const original = makeOffer('same');
  const changed = { ...original, name: 'Changed in another tab' };
  const outcome = await page.evaluate(async ({ original, changed }) => {
    const path = '/src/storage/db.ts';
    const { offerStore, prepareImport, commitImport } = await import(path);
    await offerStore.put(original);
    const preview = await prepareImport([{ ...original, name: 'Imported replacement' }, { ...original, id: 'new' }]);
    await offerStore.put(changed);
    let error = '';
    try { await commitImport(preview); } catch (e) { error = String(e); }
    return { error, records: await offerStore.list() };
  }, { original, changed });
  expect(outcome.error).toContain('重新预览');
  expect(outcome.records).toEqual([changed]);
});

test('a later invalid import record is rejected before any earlier replacement is written', async ({ page }) => {
  const original = makeOffer('existing');
  const outcome = await page.evaluate(async (original) => {
    const path = '/src/storage/db.ts';
    const { offerStore, prepareImport, commitImport } = await import(path);
    await offerStore.put(original);
    const replacement = { ...original, name: 'Should not be written' };
    let prepareRejected = false;
    try { await prepareImport([replacement, { ...original, id: 'invalid', salary: null }]); }
    catch { prepareRejected = true; }
    const preview = await prepareImport([replacement, { ...original, id: 'later-invalid' }]);
    preview.offers[1].salary.baseMonthly = -1;
    let commitRejected = false;
    try { await commitImport(preview); } catch { commitRejected = true; }
    return { prepareRejected, commitRejected, records: await offerStore.list() };
  }, original);
  expect(outcome).toEqual({ prepareRejected: true, commitRejected: true, records: [original] });
});

test('a committed save stays successful when the subsequent list refresh fails', async ({ page }) => {
  await page.goto('/#/offers');
  await page.getByRole('button', { name: '+ 新建 Offer', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('Committed despite refresh failure');
  await page.getByLabel('月基本工资（元）', { exact: true }).fill('10000');
  await page.evaluate(async () => {
    const path = '/src/storage/db.ts';
    const { offerStore } = await import(path);
    offerStore.list = async () => { throw new Error('Injected post-commit refresh failure'); };
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText(/已保存，但列表刷新失败/)).toBeVisible();
  await expect(page.getByText(/^保存失败/)).toHaveCount(0);
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('offerithm');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('offers').objectStore('offers').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return records;
  });
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ name: 'Committed despite refresh failure', salary: { baseMonthly: 10000 } });
});

test('restoring an old partial draft exposes missing inputs instead of calculating defaults', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/src/storage/db.ts';
    const { draftStore } = await import(path);
    await draftStore.put({ id: 'partial', name: 'Old unfinished draft', salary: { baseMonthly: 12345 } });
  });
  await page.goto('/#/offers');
  await expect(page.getByText('Old unfinished draft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /恢复/ }).click();
  await expect(page.getByLabel('月基本工资（元）', { exact: true })).toHaveValue('12345');
  await expect(page.getByLabel('住房（元/月）', { exact: true })).toHaveValue('');
  await expect(page.getByText('年度结果（基准情景）', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/livingCost|生活成本.*必填|字段.*不完整|请补齐/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await page.getByLabel('年终奖（元/年）', { exact: true }).fill('0');
  await page.getByRole('combobox', { name: '地区政策', exact: true }).selectOption('bj-2025-example');
  await page.getByRole('combobox', { name: '年终奖计税', exact: true }).selectOption('combined');
  for (const label of ['住房（元/月）', '餐饮（元/月）', '交通（元/月）', '水电等（元/月）', '其他（元/月）', '年度额外支出（元/年）']) {
    await page.getByLabel(label, { exact: true }).fill('0');
  }
  for (const [label, value] of [['每周工时（小时）', '40'], ['单程通勤（分钟）', '20'], ['每月出差天数', '0'], ['年假天数', '5']] as const) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  const persisted = await page.evaluate(async () => {
    const path = '/src/storage/db.ts';
    const { offerStore, draftStore } = await import(path);
    return { formal: await offerStore.get('partial'), draft: await draftStore.get('partial') };
  });
  expect(persisted.formal).toMatchObject({ id: 'partial', name: 'Old unfinished draft', salary: { baseMonthly: 12345 } });
  expect(persisted.draft).toBeUndefined();
});

test('legacy malformed formal records are diagnosed without breaking lists or comparison', async ({ page }) => {
  const valid = makeOffer('valid');
  await page.evaluate(async (valid) => {
    const path = '/src/storage/db.ts';
    const { offerStore } = await import(path);
    await offerStore.put(valid);
    await offerStore.put({ id: 'old-bad', name: 'Legacy broken record', salary: null });
    await offerStore.put({ ...valid, id: 'old-policy', name: 'Legacy unknown policy', regionPolicyId: 'unknown' });
  }, valid);
  await page.goto('/#/offers');
  await expect(page.getByRole('heading', { name: '我的 Offer', exact: true })).toBeVisible();
  await expect(page.getByText('Legacy broken record', { exact: true })).toBeVisible();
  await expect(page.getByText(/无效|无法计算|校验|不完整|未计算/).first()).toBeVisible();
  await page.goto('/#/compare');
  await expect(page.getByRole('heading', { name: '多 Offer 比较', exact: true })).toBeVisible();
  await expect(page.locator('thead th')).toHaveText(['指标', valid.name]);
  await expect(page.getByText(/Legacy broken record/)).toBeVisible();
  await expect(page.getByText(/Legacy unknown policy/)).toBeVisible();
});
