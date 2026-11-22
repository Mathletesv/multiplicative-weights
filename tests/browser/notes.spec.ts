import { test, expect } from '@playwright/test';

test('static notes render forward references, TeX, Typst assets, and accessible equivalents', async ({ page }) => {
  await page.goto('learn/experts/');
  await expect(page.locator('[data-block-ref="experts/result"]')).toHaveText('Theorem 1.1');
  await expect(page.locator('#result')).toContainText('Lorem ipsum');
  await expect(page.locator('#sum-equation img')).toHaveAttribute('alt', /sum of x/);
  await expect(page.locator('#semantic-equation math')).toHaveCount(1);
  await expect(page.locator('#semantic-equation img')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#component-equation > .visually-hidden')).toHaveText('x plus one');
  expect(await page.locator('.typst-block img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('.reading-content > p .katex').first()).toBeVisible();
  await expect(page.getByText('Theorem 07', { exact: true })).toBeVisible();
  await page.locator('[data-block-ref="games/other-result"]').click();
  await expect(page.locator('#other-result')).toBeVisible();
  await expect(page.locator('[data-block-ref="experts/result"]')).toHaveText('Theorem 1.1');
});

test('proof summary slots and native keyboard toggles work independently', async ({ page }) => {
  await page.goto('learn/experts/');
  const proof = page.locator('#proof');
  const summary = proof.locator(':scope > summary');
  await expect(summary).toHaveText('Custom proof summary');
  await expect(proof).not.toHaveAttribute('open');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(proof).toHaveAttribute('open', '');
  await proof.getByRole('button', { name: 'Next step' }).press('Enter');
  await page.locator('#nested-hint > summary').click();
  await page.locator('#second-hint > summary').click();
  await expect(page.locator('#nested-hint')).toHaveAttribute('open', '');
  await expect(page.locator('#second-hint')).toHaveAttribute('open', '');
  await summary.focus();
  await page.keyboard.press('Space');
  await expect(proof).not.toHaveAttribute('open');
});

test('Typst display equations align relations across rows of different lengths', async ({ page }) => {
  await page.goto('learn/games/');
  await page.locator('#aligned-proof > summary').click();
  await page.getByRole('button', { name: 'Show full proof' }).click();
  const operators = page.locator('mtable.aligned > mtr > mtd:nth-child(2) > mo:first-child');
  await expect(operators).toHaveCount(2);
  await expect(operators.first()).toBeVisible();
  const leftEdges = await operators.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().left));
  expect(leftEdges[0]).toBeCloseTo(leftEdges[1], 0);
});

test('a Typst display keeps its final term on the same line and scrolls locally when narrow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('learn/games/');
  const display = page.locator('#other-result .typst-display');
  const measure = () => display.evaluate(region => {
    const math = region.querySelector('math')!;
    const first = math.firstElementChild!;
    const last = math.lastElementChild!;
    const bounds = region.getBoundingClientRect();
    region.scrollLeft = 0;
    const startOffset = first.getBoundingClientRect().left - bounds.left;
    region.scrollLeft = region.scrollWidth;
    return {
      startOffset,
      endOffset: bounds.right - last.getBoundingClientRect().right,
      lastTermTop: last.getBoundingClientRect().top,
      precedingTermBottom: last.previousElementSibling!.getBoundingClientRect().bottom,
      scroll: region.scrollLeft,
    };
  });
  const wide = await measure();
  expect(wide.lastTermTop).toBeLessThan(wide.precedingTermBottom);
  expect(wide.startOffset).toBeCloseTo(wide.endOffset, 0);
  expect(wide.scroll).toBe(0);

  await page.setViewportSize({ width: 320, height: 700 });
  const narrow = await measure();
  expect(narrow.lastTermTop).toBeLessThan(narrow.precedingTermBottom);
  expect(narrow.scroll).toBeGreaterThan(0);
  expect(narrow.startOffset).toBeGreaterThanOrEqual(-1);
  expect(narrow.endOffset).toBeGreaterThanOrEqual(-1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('proof steps reveal paragraphs, list items and equation rows in order', async ({ page }) => {
  await page.goto('learn/games/');
  const proof = page.locator('#aligned-proof');
  const summary = proof.locator('summary');
  const next = proof.getByRole('button', { name: 'Next step' });
  const rows = proof.locator('mtable.aligned > mtr');
  const list = proof.locator('ol > li');
  const end = proof.getByText('Last proof paragraph.');
  await summary.click();
  await expect(proof.getByRole('status')).toHaveText('Step 1 of 6');
  await expect(proof.getByText('First proof paragraph.')).toBeVisible();
  await expect(list.first()).toBeHidden();
  await next.click();
  await expect(list.first()).toBeVisible();
  await expect(list.last()).toBeHidden();
  await next.click();
  await expect(list.last()).toBeVisible();
  await expect(rows.first()).toBeHidden();
  await next.click();
  await expect(rows.first()).toBeVisible();
  await expect(rows.last()).toBeHidden();
  await expect(end).toBeHidden();
  await summary.click();
  await summary.click();
  await expect(proof.getByRole('status')).toHaveText('Step 4 of 6');
  await next.click();
  await expect(rows.last()).toBeVisible();
  await expect(end).toBeHidden();
  await proof.getByRole('button', { name: 'Show full proof' }).click();
  await expect(end).toBeVisible();
  await proof.getByRole('button', { name: 'Start over' }).click();
  await expect(proof.getByRole('status')).toHaveText('Step 1 of 6');
  await expect(rows.first()).toBeHidden();
});

test('N advances the focused open proof and leaves text entry alone', async ({ page }) => {
  await page.goto('learn/games/');
  const proof = page.locator('#aligned-proof');
  const summary = proof.locator('summary');
  const progress = proof.getByRole('status', { includeHidden: true });
  await expect(progress).toHaveText('Step 1 of 6');
  await summary.press('n');
  await expect(proof).not.toHaveAttribute('open');
  await expect(progress).toHaveText('Step 1 of 6');

  await summary.press('Enter');
  await expect(proof.getByRole('button', { name: 'Next step' })).toHaveAttribute('aria-keyshortcuts', 'N');
  await summary.press('n');
  await expect(progress).toHaveText('Step 2 of 6');
  await expect(summary).toBeFocused();
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('n');
  await expect(progress).toHaveText('Step 2 of 6');

  await proof.evaluate((element) => {
    const input = document.createElement('input');
    element.append(input);
    input.focus();
  });
  await page.keyboard.press('n');
  await expect(proof.locator('input')).toHaveValue('n');
  await expect(progress).toHaveText('Step 2 of 6');
  await summary.press('n');
  await expect(progress).toHaveText('Step 3 of 6');
});

test('direct links and same-hash reactivation reveal every closed ancestor', async ({ page }) => {
  await page.goto('learn/experts/#deep-step');
  await expect(page.locator('#proof')).toHaveAttribute('open', '');
  await expect(page.locator('#nested-hint')).toHaveAttribute('open', '');
  await expect(page.locator('#deep-step')).toBeInViewport();
  await page.evaluate(() => {
    (document.getElementById('proof') as HTMLDetailsElement).open = false;
    (document.getElementById('nested-hint') as HTMLDetailsElement).open = false;
  });
  await page.locator('[data-block-ref="experts/deep-step"]').click();
  await expect(page.locator('#proof')).toHaveAttribute('open', '');
  await expect(page.locator('#nested-hint')).toHaveAttribute('open', '');
  await expect(page.locator('#deep-step')).toBeFocused();
  await expect(page.locator('#second-hint')).not.toHaveAttribute('open');
});

test('theorem links preserve hidden proofs and browser history reopens proof targets', async ({ page }) => {
  await page.goto('learn/experts/');
  await page.locator('[data-block-ref="experts/result"]').click();
  await expect(page.locator('#proof')).not.toHaveAttribute('open');
  await page.locator('[data-block-ref="experts/proof"]').click();
  await expect(page.locator('#proof > summary')).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/#result$/);
  await page.locator('#proof > summary').click();
  await page.goForward();
  await expect(page).toHaveURL(/#proof$/);
  await expect(page.locator('#proof')).toHaveAttribute('open', '');
});

test('print opens all disclosures and restores their prior state', async ({ page }) => {
  await page.goto('learn/experts/');
  await page.locator('#second-hint > summary').click();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  expect(await page.locator('[data-note-disclosure]').evaluateAll((items) => items.every((item) => (item as HTMLDetailsElement).open))).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#deep-step')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#proof')).not.toHaveAttribute('open');
  await expect(page.locator('#nested-hint')).not.toHaveAttribute('open');
  await expect(page.locator('#second-hint')).toHaveAttribute('open', '');
});

test('lecture prose spans the column and Typst numbers align to the right without shifting formulas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('learn/experts/');
  const column = (await page.locator('.reading-content').boundingBox())!;
  const paragraph = (await page.locator('.reading-content > p').first().boundingBox())!;
  expect(paragraph.x).toBeCloseTo(column.x, 0);
  expect(paragraph.width).toBeCloseTo(column.width, 0);

  for (const selector of ['#result', '#proof', '#sum-equation']) {
    const block = (await page.locator(selector).boundingBox())!;
    expect(block.x).toBeCloseTo(column.x, 0);
    expect(block.width).toBeCloseTo(column.width, 0);
  }
  const statement = (await page.locator('#result .statement').boundingBox())!;
  const statementParagraph = (await page.locator('#result .statement > p').boundingBox())!;
  expect(statementParagraph.width).toBeCloseTo(statement.width, 0);

  const typst = (await page.locator('#sum-equation img').boundingBox())!;
  const latex = (await page.locator('#result .katex-display .katex-html > .base').first().boundingBox())!;
  expect(typst.x + typst.width / 2).toBeCloseTo(column.x + column.width / 2, 0);
  expect(latex.x + latex.width / 2).toBeCloseTo(statement.x + statement.width / 2, 0);

  const number = (await page.locator('#sum-equation .equation-label a').boundingBox())!;
  const numberRow = (await page.locator('#sum-equation .equation-label').boundingBox())!;
  expect(number.x + number.width).toBeCloseTo(column.x + column.width, 0);
  expect(numberRow.y + numberRow.height / 2).toBeCloseTo(typst.y + typst.height / 2, 0);
});

test('320px reflow keeps both ends of wide equations reachable in a local scroll region', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('learn/experts/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const number = (await page.locator('#wide-equation .equation-label a').boundingBox())!;
  const equation = (await page.locator('#wide-equation .math-scroll').boundingBox())!;
  expect(number.y).toBeGreaterThanOrEqual(equation.y + equation.height - 1);
  expect(number.x + number.width).toBeCloseTo(equation.x + equation.width, 0);
  const scrollers = [
    { region: page.locator('#wide-equation .math-scroll'), start: 'img', end: 'img' },
    { region: page.locator('#result .katex-display').last(), start: '.base:first-child', end: '.base:last-child' },
  ];
  for (const { region, start, end } of scrollers) {
    const edges = await region.evaluate((element, { start, end }) => {
      const bounds = element.getBoundingClientRect();
      const startOffset = element.querySelector(start)!.getBoundingClientRect().left - bounds.left;
      element.scrollLeft = element.scrollWidth;
      return {
        startOffset,
        endOffset: bounds.right - element.querySelector(end)!.getBoundingClientRect().right,
        scroll: element.scrollLeft,
      };
    }, { start, end });
    expect(edges.scroll).toBeGreaterThan(0);
    expect(edges.startOffset).toBeGreaterThanOrEqual(-1);
    expect(edges.endOffset).toBeGreaterThanOrEqual(-1);
  }
  await page.goto('learn/experts/#%E0%A4%A');
  await expect(page.locator('#result')).toBeVisible();
});

test('titles and equation numbers copy their permalinks and still navigate if copying fails', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-write', 'clipboard-read']);
  await page.goto('learn/experts/');
  const title = page.getByRole('link', { name: /^Theorem 1\.1 — Lorem ipsum$/ });
  const equation = page.getByRole('link', { name: '(1.1)', exact: true });
  const proof = page.getByRole('link', { name: 'Custom proof summary' });
  const status = page.locator('[data-copy-status]');
  await title.click();
  await expect(status).toHaveText('Link copied.');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/learn\/experts\/#result$/);
  await equation.press('Enter');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/learn\/experts\/#sum-equation$/);
  await proof.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/learn\/experts\/#proof$/);
  await expect(page.locator('#proof')).not.toHaveAttribute('open');
  await expect(page).toHaveURL(/learn\/experts\/$/);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Fixture denial'); }; });
  await equation.click();
  await expect(status).toContainText('Copy failed');
  await expect(page).toHaveURL(/#sum-equation$/);
});

test('native disclosures, math, and cross-note links work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('learn/experts/');
  await page.locator('#proof > summary').click();
  await expect(page.locator('#proof')).toHaveAttribute('open', '');
  await expect(page.locator('#nested-hint > summary')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0);
  await expect(page.locator('#sum-equation img')).toBeVisible();
  await page.getByRole('link', { name: '(1.1)', exact: true }).click();
  await expect(page).toHaveURL(/#sum-equation$/);
  await page.locator('[data-block-ref="games/other-result"]').click();
  await expect(page.locator('#other-result')).toBeVisible();
  await context.close();
});
