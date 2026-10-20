import { expect, test } from '@playwright/test';

// 首页冒烟：只断言语义级要素（品牌文本与导航存在），不绑定类名/DOM 结构，
// 供后续 UI 票（IMP-09 起）复用同一基建。
test('首页冒烟：品牌与主导航可见', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('薪筹').first()).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
});
