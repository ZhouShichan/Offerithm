import { expect, test } from '@playwright/test';
import { makeOffer } from './fixtures';

const file = (offers: unknown[]) => ({
  name: 'review.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({
    app: 'offerithm', version: 1, exportedAt: '2026-01-01T00:00:00.000Z', offers,
  })),
});

test('a newly selected invalid file clears the previous preview and cancellation writes nothing', async ({ page }) => {
  await page.goto('/#/settings');
  const input = page.getByLabel('导入 JSON', { exact: true });
  await input.setInputFiles(file([makeOffer('previous')]));
  await expect(page.getByRole('dialog', { name: '导入预览' })).toContainText('previous');
  await input.setInputFiles(file([{ ...makeOffer('invalid'), salary: null }]));
  await expect(page.getByRole('status')).toContainText('失败');
  await expect(page.getByRole('dialog', { name: '导入预览' })).toHaveCount(0);
  await input.setInputFiles(file([makeOffer('cancelled')]));
  await page.getByRole('button', { name: '取消', exact: true }).click();
  const records = await page.evaluate(async () => {
    const path = '/src/storage/db.ts';
    const { offerStore } = await import(path);
    return offerStore.list();
  });
  expect(records).toEqual([]);
});

test('an intervening addition requires another preview and explicit confirmation', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('导入 JSON', { exact: true }).setInputFiles(file([makeOffer('same')]));
  await expect(page.getByRole('dialog', { name: '导入预览' })).toContainText('新增 1');
  await page.evaluate(async offer => {
    const path = '/src/storage/db.ts';
    const { offerStore } = await import(path);
    await offerStore.put(offer);
  }, { ...makeOffer('same'), name: 'Changed after preview' });
  await page.getByRole('button', { name: '确认导入', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('重新预览');
  await page.getByRole('button', { name: '重新预览', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '导入预览' })).toContainText('覆盖 1');
  await expect(page.getByRole('dialog', { name: '导入预览' })).toContainText('Changed after preview');
  const before = await page.evaluate(async () => {
    const path = '/src/storage/db.ts';
    const { offerStore } = await import(path);
    return offerStore.get('same');
  });
  expect(before.name).toBe('Changed after preview');
  await page.getByRole('button', { name: '确认导入', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已导入 0 个，覆盖 1 个');
});

test('an aborted save keeps all inputs for retry and later edits clear the saved status', async ({ page }) => {
  await page.goto('/#/offers');
  await page.getByRole('button', { name: '+ 新建 Offer', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('Retry my offer');
  await page.getByLabel('月基本工资（元）', { exact: true }).fill('12000');
  await page.getByLabel('住房（元/月）', { exact: true }).fill('1234');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      if (this.name === 'offers') {
        IDBObjectStore.prototype.put = original;
        request.addEventListener('success', () => this.transaction.abort(), { once: true });
      }
      return request;
    };
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('写入失败');
  await expect(page.getByLabel('住房（元/月）', { exact: true })).toHaveValue('1234');
  await expect(page.getByLabel('月基本工资（元）', { exact: true })).toHaveValue('12000');
  const count = await page.evaluate(async () => {
    const path = '/src/storage/db.ts';
    const { offerStore } = await import(path);
    return (await offerStore.list()).length;
  });
  expect(count).toBe(0);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('已保存');
  await page.getByLabel('住房（元/月）', { exact: true }).fill('2345');
  await expect(page.getByText('已保存', { exact: true })).toHaveCount(0);
});
