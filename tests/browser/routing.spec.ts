import { expect, test } from '@playwright/test';

test('static routes render, stay in the deployment path, and survive reload', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseURL!);
  await expect(page.getByRole('heading', { name: '算清薪酬，筹划前程', exact: true })).toBeVisible();

  for (const [link, route, heading] of [
    ['我的 Offer', 'offers', '我的 Offer'],
    ['比较', 'compare', '多 Offer 比较'],
    ['设置', 'settings', '设置与数据'],
  ]) {
    await page.getByRole('link', { name: link, exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}#/${route}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    // A new document request must also work, rather than relying on SPA history.
    await page.goto(`${baseURL}#/${route}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
