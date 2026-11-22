import { test, expect } from '@playwright/test';

test('the weight simulation steps, pauses, and stops after the configured number of decisions', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('learn/multiplicative-weight-updates/');
  const widget = page.getByRole('region', { name: 'Weight simulation' });
  const summary = widget.locator('summary');
  const cards = widget.getByRole('list', { name: 'Expert losses and weights' });
  const progress = widget.getByRole('status');
  const count = widget.getByRole('slider', { name: 'Decisions' });
  const epsilon = widget.getByRole('slider', { name: 'Epsilon' });
  const next = widget.getByRole('button', { name: 'Next decision' });
  const autoplay = widget.getByRole('button', { name: 'Autoplay' });
  const reset = widget.getByRole('button', { name: 'Reset' });
  await expect(next).toBeHidden();
  await summary.press('Enter');
  await expect(next).toBeEnabled();
  await expect(cards.getByRole('listitem')).toHaveCount(10);
  const profiles = cards.getByLabel('Gaussian loss parameters');
  await expect(profiles).toHaveCount(10);
  const initial = await profiles.allTextContents();
  expect(new Set(initial).size).toBe(10);
  await reset.press('Enter');
  await expect.poll(() => profiles.allTextContents()).not.toEqual(initial);
  const runProfiles = await profiles.allTextContents();
  await expect(progress).toHaveText('Decision 0 of 30');
  const weights = cards.locator('dl > div').filter({ has: page.getByText('Weight', { exact: true }) }).locator('dd');
  await expect(weights).toHaveText(Array(10).fill('1.000'));
  await expect(cards.getByText('Cumulative loss', { exact: true })).toHaveCount(10);
  await expect(count).toHaveAttribute('min', '20');
  await expect(count).toHaveAttribute('max', '50');
  await count.fill('20');
  await expect(progress).toHaveText('Decision 0 of 20');
  expect(await profiles.allTextContents()).toEqual(runProfiles);
  await expect(next).toHaveAttribute('aria-keyshortcuts', 'N');
  await count.press('n');
  await expect(progress).toHaveText('Decision 0 of 20');
  await summary.press('Enter');
  await summary.press('n');
  await summary.press('Enter');
  await expect(progress).toHaveText('Decision 0 of 20');
  await widget.press('n');
  await expect(progress).toHaveText('Decision 1 of 20');
  await expect(cards.getByText('Selected', { exact: true })).toHaveCount(1);
  expect((await weights.allTextContents()).some(value => Number(value) < 1)).toBe(true);
  const expert = cards.getByRole('listitem').first();
  const lossValue = (label: string) => expert.locator('dl > div').filter({
    has: page.getByText(label, { exact: true }),
  }).locator('dd');
  const firstLoss = (await lossValue('Loss').innerText()).trim();
  await expect(lossValue('Cumulative loss')).toHaveText(firstLoss);
  await epsilon.fill('0');
  await expect(progress).toHaveText('Decision 1 of 20');
  expect(await profiles.allTextContents()).toEqual(runProfiles);
  await expect(lossValue('Cumulative loss')).toHaveText(firstLoss);
  await expect(weights).toHaveText(Array(10).fill('1.000'));
  await expect(widget.getByText('Algorithm cumulative loss', { exact: true })).toBeVisible();

  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
  await autoplay.press('Enter');
  await expect(next).toBeDisabled();
  await summary.press('n');
  await page.clock.runFor(1999);
  await expect(progress).toHaveText('Decision 1 of 20');
  await page.clock.runFor(1);
  await expect(progress).toHaveText('Decision 2 of 20');
  await widget.getByRole('button', { name: 'Pause' }).press('Enter');
  await page.clock.runFor(6000);
  await expect(progress).toHaveText('Decision 2 of 20');

  await autoplay.press('Enter');
  await summary.press('Enter');
  await expect(progress).toBeHidden();
  await expect(widget.locator('button').filter({ hasText: /^Autoplay$/ })).toHaveCount(1);
  await page.clock.runFor(6000);
  await summary.press('Enter');
  await expect(progress).toHaveText('Decision 2 of 20');

  await autoplay.press('Enter');
  await page.clock.runFor(40_000);
  await expect(progress).toHaveText('Decision 20 of 20');
  await expect(next).toBeDisabled();
  await expect(autoplay).toBeDisabled();
  await reset.press('Enter');
  await expect(progress).toHaveText('Decision 0 of 20');
  await expect.poll(() => profiles.allTextContents()).not.toEqual(runProfiles);
  await expect(weights).toHaveText(Array(10).fill('1.000'));
  await count.fill('50');
  await expect(progress).toHaveText('Decision 0 of 50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the fair-coin game plays all ten rounds and reports scores for ten coin-flip experts', async ({ page }) => {
  await page.goto('learn/multiplicative-weight-updates/');
  const game = page.getByRole('region', { name: 'Coin-Flip Experts' });
  const summary = game.locator('summary');
  const cards = game.getByRole('list', { name: 'Expert votes and records' });
  const guess = game.getByRole('button', { name: 'True', exact: true });
  await expect(guess).toBeHidden();
  await summary.press('Enter');
  await expect(guess).toBeEnabled();
  await expect(cards.getByRole('listitem')).toHaveCount(10);
  for (let round = 1; round <= 10; round++) {
    await expect(game.getByRole('heading', { name: `Conjecture ${round}`, exact: true })).toBeVisible();
    await page.keyboard.press(round % 2 === 0 ? 'f' : 't');
    if (round === 1) {
      await summary.press('Enter');
      await expect(game.getByRole('button', { name: 'Next round' })).toBeHidden();
      await summary.press('Enter');
    }
    await expect(game.getByRole('button', { name: round === 10 ? 'See results' : 'Next round' }))
      .toHaveAttribute('aria-keyshortcuts', 'N');
    await summary.press('n');
  }
  const scores = game.getByRole('table');
  await expect(scores.getByText('Coin flip', { exact: true })).toHaveCount(10);
  await expect(game.getByText('Best fixed expert')).toBeVisible();
  await game.getByRole('button', { name: 'New game' }).press('Enter');
  await expect(game.getByRole('heading', { name: 'Conjecture 1', exact: true })).toBeVisible();
});
