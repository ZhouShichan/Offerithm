import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { makeOffer } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('./#/offers');
});

async function seedOffer(page: Page, offer: ReturnType<typeof makeOffer>) {
  await page.evaluate(async (record) => {
    const request = indexedDB.open('offerithm', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onupgradeneeded = () => {
        request.result.createObjectStore('offers', { keyPath: 'id' });
        request.result.createObjectStore('drafts', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('offers', 'readwrite');
      tx.objectStore('offers').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, offer);
}

test('cost and work assumptions recalculate live and persist after reopening', async ({ page }) => {
  await page.getByRole('button', { name: /新建 Offer/ }).click();
  await page.getByLabel('月基本工资（元）').fill('10000');
  const savingsBeforeCosts = Number((await page.getByText('年净储蓄').locator('..').locator('dd').innerText()).replaceAll(',', ''));
  await page.getByLabel('住房（元/月）').fill('1000');
  await page.getByLabel('餐饮（元/月）').fill('500');
  await page.getByLabel('交通（元/月）').fill('200');
  await page.getByLabel('水电等（元/月）').fill('100');
  await page.getByLabel('其他（元/月）').fill('50');
  await page.getByLabel('年度额外支出（元/年）').fill('600');
  await page.getByLabel('每周工时（小时）').fill('50');
  await page.getByLabel('单程通勤（分钟）').fill('45');
  await page.getByLabel('每月出差天数').fill('2');
  await page.getByLabel('年假天数').fill('10');
  const savingsAfterCosts = Number((await page.getByText('年净储蓄').locator('..').locator('dd').innerText()).replaceAll(',', ''));
  expect(savingsAfterCosts).toBe(savingsBeforeCosts - 22800);
  await expect(page.getByText('年度生活成本').locator('..')).toContainText('22,800');
  await expect(page.getByText('含通勤有效时薪（元/小时）').locator('..')).toContainText('45');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已保存')).toBeVisible();
  await page.getByLabel('住房（元/月）').fill('1100');
  await expect(page.getByText('已保存', { exact: true })).toHaveCount(0);
  await expect(page.getByText('年度生活成本').locator('..')).toContainText('24,000');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已保存')).toBeVisible();
  await page.getByRole('button', { name: '返回列表' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '我的 Offer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑' }).click();
  await expect(page.getByLabel('住房（元/月）')).toHaveValue('1100');
  await expect(page.getByLabel('餐饮（元/月）')).toHaveValue('500');
  await expect(page.getByLabel('交通（元/月）')).toHaveValue('200');
  await expect(page.getByLabel('水电等（元/月）')).toHaveValue('100');
  await expect(page.getByLabel('其他（元/月）')).toHaveValue('50');
  await expect(page.getByLabel('年度额外支出（元/年）')).toHaveValue('600');
  await expect(page.getByLabel('每周工时（小时）')).toHaveValue('50');
  await expect(page.getByLabel('单程通勤（分钟）')).toHaveValue('45');
  await expect(page.getByLabel('每月出差天数')).toHaveValue('2');
  await expect(page.getByLabel('年假天数')).toHaveValue('10');
  await expect(page.getByText('年度生活成本').locator('..')).toContainText('24,000');
});

test('drafts can be restored and deleted without creating a saved offer', async ({ page }) => {
  await page.getByRole('button', { name: /新建 Offer/ }).click();
  await page.getByLabel('名称').fill('未完成草稿');
  await page.getByLabel('月基本工资（元）').fill('');
  await page.getByRole('button', { name: '存为草稿' }).click();
  await expect(page.getByRole('heading', { name: '草稿' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '草稿' })).toBeVisible();
  const draft = page.getByRole('listitem').filter({ hasText: '未完成草稿' });
  await expect(draft).toBeVisible();
  await draft.getByRole('button', { name: '恢复', exact: true }).click();
  await expect(page.getByLabel('名称')).toHaveValue('未完成草稿');
  await expect(page.getByLabel('月基本工资（元）')).toHaveValue('');
  await page.getByRole('button', { name: '返回列表' }).click();
  await expect(page.getByText('还没有保存的 Offer')).toBeVisible();
  await page.getByRole('button', { name: '删除草稿' }).click();
  await expect(page.getByText('未完成草稿')).toHaveCount(0);
});

test('JSON import validates first, previews additions and overwrites, then confirms', async ({ page }) => {
  const existing = makeOffer('same', 12000);
  await seedOffer(page, existing);
  await page.goto('./#/settings');
  const input = page.locator('input[type=file]');
  const invalid = makeOffer('invalid');
  invalid.salary.baseMonthly = -1;
  await input.setInputFiles({
    name: 'invalid.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'offerithm', version: 1, exportedAt: new Date().toISOString(), offers: [invalid] })),
  });
  await expect(page.getByText(/导入失败/)).toBeVisible();
  const absent = await page.evaluate(async () => {
    const request = indexedDB.open('offerithm', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction('offers', 'readonly');
      const get = tx.objectStore('offers').get('invalid');
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    db.close();
    return value;
  });
  expect(absent).toBeUndefined();

  const updated = makeOffer('same', 15000);
  const added = makeOffer('new', 9000);
  await input.setInputFiles({
    name: 'valid.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'offerithm', version: 1, exportedAt: new Date().toISOString(), offers: [updated, added] })),
  });
  await expect(page.getByRole('dialog', { name: '导入预览' })).toContainText('新增 1');
  await expect(page.getByRole('dialog', { name: '导入预览' })).toContainText('覆盖 1');
  await expect(page.getByRole('dialog', { name: '导入预览' })).toContainText('same');
  await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByText('已导入 1 个，覆盖 1 个')).toBeVisible();
  const actual = await page.evaluate(async () => {
    const request = indexedDB.open('offerithm', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise<Record<string, ReturnType<typeof makeOffer> | undefined>>((resolve, reject) => {
      const tx = db.transaction('offers', 'readonly');
      const store = tx.objectStore('offers');
      const same = store.get('same');
      const added = store.get('new');
      tx.oncomplete = () => resolve({ same: same.result, added: added.result });
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return values;
  });
  expect(actual.same?.salary.baseMonthly).toBe(15000);
  expect(actual.added?.salary.baseMonthly).toBe(9000);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出 JSON' }).click(),
  ]);
  const exported = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of exported) chunks.push(Buffer.from(chunk));
  const exportedText = Buffer.concat(chunks).toString('utf8');
  await page.goto('./#/offers');
  for (const id of ['same', 'new']) {
    const row = page.getByRole('listitem').filter({ hasText: id === 'same' ? 'Offer SAME' : 'Offer NEW' });
    await row.getByRole('button', { name: '删除' }).click();
  }
  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles({
    name: 'round-trip.json', mimeType: 'application/json', buffer: Buffer.from(exportedText),
  });
  await expect(page.getByRole('dialog', { name: '导入预览' })).toContainText('新增 2');
  await page.getByRole('button', { name: '确认导入' }).click();
  const restored = await page.evaluate(async () => {
    const request = indexedDB.open('offerithm', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<ReturnType<typeof makeOffer>[]>((resolve, reject) => {
      const tx = db.transaction('offers', 'readonly');
      const get = tx.objectStore('offers').getAll();
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    db.close();
    return rows;
  });
  expect(restored.map((offer) => [offer.id, offer.salary.baseMonthly]).sort()).toEqual([
    ['new', 9000], ['same', 15000],
  ]);
});
