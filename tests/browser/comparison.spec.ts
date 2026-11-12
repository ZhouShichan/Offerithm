import { expect, test } from '@playwright/test';
import { makeOffer } from './fixtures';

test('scores stay with their Offer when ranking opposes the table column order', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}#/settings`);
  await page.locator('input[type=file]').setInputFiles({
    name: 'offers.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      app: 'offerithm', version: 1, exportedAt: '2026-01-01T00:00:00.000Z',
      offers: [makeOffer('a', 10000), makeOffer('b', 20000)],
    })),
  });
  await expect(page.getByText('已导入 2 个 Offer。', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '比较', exact: true }).click();
  const sliders = page.locator('input[type=range]');
  await expect(sliders).toHaveCount(6);
  for (const slider of await sliders.all()) await slider.press('Home');
  await sliders.first().press('End');

  const assertColumns = async () => {
    await expect(page.locator('thead th')).toHaveText(['指标', 'Offer A', 'Offer B']);
    const scoreRow = page.getByRole('row').filter({ hasText: '综合得分' });
    await expect(scoreRow.locator('td')).toHaveText(['综合得分', '0', '100']);
  };
  await assertColumns();
  for (const scenario of ['悲观', '乐观', '基准']) {
    await page.getByRole('button', { name: scenario, exact: true }).click();
    await assertColumns();
  }
  // Equal and zero scores must still render a cell for every Offer.
  await sliders.first().press('Home');
  await expect(page.getByRole('row').filter({ hasText: '综合得分' }).locator('td'))
    .toHaveText(['综合得分', '0', '0']);
});
