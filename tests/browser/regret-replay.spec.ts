import { test, expect } from '@playwright/test';
import { createBoard, scoreGuesses } from '../../src/lib/experts/game.ts';

test('replays the original guesses and keeps an independent game when switching views', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.125; });
  await page.goto('learn/experts/');
  const opening = page.getByRole('region', { name: 'Trust the Streak?' });
  const replay = page.getByRole('region', { name: 'Replay with realized regret' });
  const replaySummary = replay.locator('summary');
  await expect(replay.locator('details')).not.toHaveAttribute('open');
  await replaySummary.press('Enter');
  await expect(replay.getByRole('heading', { name: 'Conjecture 1' })).toBeVisible();
  await expect(replay.getByRole('region')).toHaveCount(0);
  await replaySummary.press('n');
  await expect(replay.getByRole('heading', { name: 'Conjecture 1' })).toBeVisible();
  const trueButton = replay.getByRole('button', { name: 'True', exact: true });
  const falseButton = replay.getByRole('button', { name: 'False', exact: true });
  await expect(trueButton).toBeEnabled();
  await expect(trueButton).toHaveAttribute('aria-keyshortcuts', 'T');
  await expect(falseButton).toHaveAttribute('aria-keyshortcuts', 'F');
  await replaySummary.press('Enter');
  await replaySummary.press('f');
  await replaySummary.press('Enter');
  await expect(replay.getByRole('status')).toBeEmpty();

  await opening.locator('summary').press('Enter');
  await expect(opening.getByRole('button', { name: 'False', exact: true })).toBeEnabled();
  await replaySummary.press('t');
  await expect(replay.getByText('After 1 round', { exact: true })).toBeVisible();
  await expect(replay.getByRole('button', { name: 'Next round' })).toBeFocused();
  await expect(opening.getByRole('status')).toBeEmpty();
  await replaySummary.press('f');
  await expect(replay.getByRole('status')).toContainText('You chose True');
  for (const key of ['f', 't']) {
    await opening.locator('summary').press(key);
    await opening.locator('summary').press('n');
  }
  await replay.getByRole('button', { name: 'Replay opening game' }).click();
  const board = createBoard('mixed-accuracy', 0x20000000);
  const guesses = [false, true];
  for (const count of [1, 2]) {
    await expect(replay.getByRole('heading', { name: `Replay round ${count} of 2` })).toBeVisible();
    await expect(replay.getByText(`Verdict: ${board.rounds[count - 1].verdict ? 'True' : 'False'} · You chose ${guesses[count - 1] ? 'True' : 'False'}`, { exact: true }).filter({ visible: true })).toBeVisible();
    const score = scoreGuesses(board, guesses.slice(0, count));
    await expect(replay.locator('dl:visible dd')).toHaveText([score.playerMistakes, score.bestMistakes, score.regret].map(String));
    if (count === 1) {
      await expect(replay.getByRole('button', { name: 'Next round' })).toHaveAttribute('aria-keyshortcuts', 'N');
      await replay.locator('summary').press('n');
    }
  }
  await replay.locator('summary').press('Enter');
  await replay.locator('summary').press('Enter');
  await expect(replay.getByRole('heading', { name: 'Replay round 2 of 2' })).toBeVisible();
  await replay.getByRole('button', { name: 'Previous round' }).click();
  await replay.getByRole('button', { name: 'Return to your game' }).click();
  await expect(replay.getByRole('status')).toContainText('You chose True');
  await replay.locator('summary').press('n');
  await expect(replay.getByRole('heading', { name: 'Conjecture 2' })).toBeFocused();
});
