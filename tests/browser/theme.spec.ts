import { test, expect } from '@playwright/test';

test('the header toggle follows the system by default and saves the selected theme across routes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('learn/experts/');
  const toggle = page.getByRole('button', { name: 'Dark mode' });
  const body = page.locator('body');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(body).toHaveCSS('background-color', 'rgb(21, 27, 24)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(body).toHaveCSS('background-color', 'rgb(250, 249, 246)');

  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(body).toHaveCSS('background-color', 'rgb(21, 27, 24)');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Search' }).click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(body).toHaveCSS('background-color', 'rgb(21, 27, 24)');
  await page.reload();
  await expect(body).toHaveCSS('background-color', 'rgb(21, 27, 24)');

  await page.emulateMedia({ colorScheme: 'dark' });
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(body).toHaveCSS('background-color', 'rgb(250, 249, 246)');
  await page.reload();
  await expect(body).toHaveCSS('background-color', 'rgb(250, 249, 246)');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, colorScheme: 'dark' });

  test('uses the system palette', async ({ page }) => {
    await page.goto('learn/experts/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(21, 27, 24)');
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveCount(0);
  });
});
