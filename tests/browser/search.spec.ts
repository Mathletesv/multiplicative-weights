import { expect, test } from '@playwright/test';

test('site search supports shared queries and opens deeply nested results', async ({ page }) => {
  await page.goto('learn/experts/');
  await page.getByRole('link', { name: 'Search' }).click();
  const input = page.getByRole('searchbox');
  await input.fill('nested fixture');
  await expect(page).toHaveURL(/search\/\?q=nested\+fixture$/);
  await page.reload();
  await expect(input).toHaveValue('nested fixture');
  const results = page.getByRole('list', { name: 'Search results' });
  await results.getByRole('link', { name: 'Nested fixture', exact: true }).click();
  await expect(page).toHaveURL(/learn\/experts\/#deep-step$/);
  await expect(page.locator('#proof')).toHaveAttribute('open', '');
  await expect(page.locator('#nested-hint')).toHaveAttribute('open', '');
  await expect(page.locator('#deep-step')).toBeInViewport();
});

test('search handles an empty result on a narrow screen and clears the shareable query', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('search/?q=unmatchedword');
  const status = page.locator('[data-search-status]');
  await expect(status).toHaveText('No matching notes.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('searchbox').clear();
  await expect(status).toBeEmpty();
  await expect(page).toHaveURL(/search\/$/);
});
