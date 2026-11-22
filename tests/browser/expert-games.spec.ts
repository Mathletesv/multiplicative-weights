import { test, expect } from '@playwright/test';
import { createBoard } from '../../src/lib/experts/game.ts';
import type { Board } from '../../src/lib/experts/game.ts';

function firstRoundVotes(board: Board): string[] {
  return board.experts.map(({ id }) => board.rounds[0].votes[id] ? 'True' : 'False');
}

for (const preset of [
  { id: 'reliable-experts', title: 'Find the Reliable Experts', results: 'Voting rule' },
  { id: 'mixed-accuracy', title: 'Trust the Streak?', results: 'Sampled accuracy' },
] as const) {
  test(`${preset.title} reveals votes, scores the best fixed expert, and supports review and a new game`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => { Math.random = () => 0.125; });
    await page.goto('learn/experts/');
    const game = page.getByRole('region', { name: preset.title });
    const summary = game.locator('summary');
    const cards = game.getByRole('list', { name: 'Expert votes and records' }).getByRole('listitem');
    await expect(game.locator('details')).not.toHaveAttribute('open');
    await summary.press('Enter');
    const rowLengths = await cards.evaluateAll((items) => {
      const rows = new Map<number, number>();
      for (const card of items) {
        const row = card.getBoundingClientRect().top;
        rows.set(row, (rows.get(row) ?? 0) + 1);
      }
      return [...rows.values()];
    });
    expect(rowLengths).toEqual([5, 5]);

    await page.setViewportSize({ width: 320, height: 700 });
    await game.scrollIntoViewIfNeeded();
    const choices = game.getByRole('group', { name: 'Your prediction' });
    const feedback = game.getByRole('status');
    const loadedBoard = createBoard(preset.id, 0x20000000);
    await expect(choices.getByRole('button', { name: 'True', exact: true })).toBeEnabled();
    await expect(cards.locator('.vote')).toHaveText(firstRoundVotes(loadedBoard));
    await expect(game.getByText('0/0 correct')).toHaveCount(10);
    await expect(feedback).toBeEmpty();
    await expect(game.getByText(preset.results, { exact: true })).toHaveCount(0);

    for (let round = 1; round <= 10; round++) {
      await expect(game.getByRole('heading', { name: `Conjecture ${round}`, exact: true })).toBeVisible();
      const guess = choices.getByRole('button', { name: 'True', exact: true });
      await expect(guess).toBeEnabled();
      await guess.press('Enter');
      await expect(feedback).toContainText(/Verdict: (True|False) · You chose True/);
      await expect(choices).toHaveCount(0);
      const next = game.getByRole('button', { name: round === 10 ? 'See results' : 'Next round' });
      await expect(next).toBeFocused();
      if (round === 1) {
        await summary.press('Enter');
        await expect(next).toBeHidden();
        await summary.press('Enter');
        await expect(feedback).toContainText('You chose True');
      }
      await next.press('Enter');
    }

    await expect(game.getByRole('heading', { name: 'Game results' })).toBeFocused();
    await expect(game.getByText('Best fixed expert')).toBeVisible();
    const results = game.getByRole('table');
    await expect(results.getByRole('columnheader', { name: preset.results })).toBeVisible();
    await expect(results.getByRole('rowheader')).toHaveCount(10);
    if (preset.id === 'reliable-experts') {
      const reliable = loadedBoard.experts.filter(({ accuracy }) => accuracy === 1);
      await expect(results.getByRole('row').filter({ hasText: 'Always correct' }).getByRole('rowheader'))
        .toHaveText(reliable.map(({ id }) => `Expert ${id}`));
      await expect(results.getByText('Coin flip', { exact: true })).toHaveCount(8);
    } else {
      const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 });
      await expect(results.getByText(/^[\d.]+%$/)).toHaveText(loadedBoard.experts.map(({ accuracy }) => percent.format(accuracy)));
    }
    await game.getByRole('button', { name: /^Review round 7,/ }).click();
    await expect(game.getByRole('heading', { name: 'Conjecture 7', exact: true })).toBeVisible();
    await expect(game.getByRole('button', { name: /^Review round 7,/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const other = page.getByRole('region', { name: preset.title === 'Find the Reliable Experts'
      ? 'Trust the Streak?' : 'Find the Reliable Experts' });
    await expect(other.locator('details')).not.toHaveAttribute('open');
    await expect(other.getByText('Round 1 of 10')).toHaveCount(1);
    await page.evaluate(() => { Math.random = () => 0.75; });
    await game.getByRole('button', { name: 'New game' }).click();
    await expect(game.getByRole('heading', { name: 'Conjecture 1', exact: true })).toBeFocused();
    await expect(game.getByText('0/0 correct')).toHaveCount(10);
    await expect(cards.locator('.vote')).toHaveText(firstRoundVotes(createBoard(preset.id, 0xc0000000)));
    await expect(game.getByRole('table')).toHaveCount(0);
  });
}
