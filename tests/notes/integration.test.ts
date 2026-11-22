import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serialize } from 'parse5';
import { createFixtureSite } from './fixture-site.ts';
import { htmlElements, htmlAttribute } from '../../src/integrations/notes/output.ts';
import type { SearchEntry } from '../../src/lib/search.ts';

const astro = fileURLToPath(new URL('../../node_modules/astro/bin/astro.mjs', import.meta.url));

for (const base of ['/', '/multiplicative-weights']) {
  test(`full Astro/MDX fixture builds with correct slots, assets, and references under ${base}`, async () => {
    const directory = await createFixtureSite(base);
    try {
      try {
        await promisify(execFile)(process.execPath, [astro, 'build', '--root', directory], {
          cwd: directory, timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
        });
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string };
        throw new Error((failure.stdout ?? '') + (failure.stderr ?? ''), { cause: error });
      }
      const html = await readFile(path.join(directory, 'dist/learn/experts/index.html'), 'utf8');
      const elements = htmlElements(html);
      const outlines = elements.filter((element) => htmlAttribute(element, 'aria-label') === 'On this page');
      assert.equal(outlines.length, 2);
      for (const outline of outlines) {
        const links = htmlElements(serialize(outline)).filter((element) => element.tagName === 'a');
        assert.deepEqual(links.map((link) => htmlAttribute(link, 'href')), ['#fixture-chapter', '#fixture-overview']);
      }
      const byId = (id: string) => elements.find((element) => htmlAttribute(element, 'id') === id)!;
      const prefix = base === '/' ? '/' : base + '/';
      assert.equal(htmlAttribute(byId('proof'), 'open'), undefined);
      assert.equal(htmlAttribute(byId('nested-hint'), 'open'), undefined);
      assert.equal(byId('proof').childNodes.filter((node) => 'tagName' in node && node.tagName === 'summary').length, 1);
      const summary = byId('proof').childNodes.find((node) => 'tagName' in node && node.tagName === 'summary');
      assert.ok(summary);
      assert.ok(JSON.stringify(summary, (key, value) => key === 'parentNode' ? undefined : value).includes('Custom proof summary'));
      const refs = elements.filter((element) => htmlAttribute(element, 'data-block-ref') === 'games/other-result');
      assert.equal(htmlAttribute(refs[0], 'href'), `${prefix}learn/games/#other-result`);
      const images = elements.filter((element) => element.tagName === 'img');
      assert.equal(images.length, 4);
      for (const image of images) {
        const src = htmlAttribute(image, 'src')!;
        assert.ok(src.startsWith(`${prefix}_notes/typst/`));
        const asset = await readFile(path.join(directory, 'dist', src.slice(prefix.length)), 'utf8');
        assert.ok(asset.includes('<svg'));
        assert.ok(Number(htmlAttribute(image, 'width')) > 0);
      }
      assert.equal(images.filter((image) => htmlAttribute(image, 'aria-hidden') === 'true').length, 2);
      assert.ok(images.some((image) => htmlAttribute(image, 'alt')?.includes('sum of x')));
      assert.equal(elements.filter((element) => element.tagName === 'math').length, 4); // Inline and display TeX, plus the Typst alternative.
      const gamesHtml = await readFile(path.join(directory, 'dist/learn/games/index.html'), 'utf8');
      const typstElements = htmlElements(gamesHtml);
      const math = typstElements.filter((element) => element.tagName === 'math');
      assert.equal(math.length, 4);
      assert.equal(htmlAttribute(math[0], 'display'), 'block');
      assert.equal(math[1].parentNode?.nodeName, 'p');
      assert.equal(htmlAttribute(math[2], 'display'), 'block');
      assert.ok(typstElements.some((element) => element.tagName === 'mtable' && htmlAttribute(element, 'class')?.includes('aligned')));
      assert.ok(typstElements.some((element) => element.tagName === 'mfrac'));
      assert.ok(typstElements.some((element) => element.tagName === 'img' && htmlAttribute(element, 'aria-hidden') === 'true'));
      assert.doesNotMatch(gamesHtml, /class="katex/);
      assert.ok(html.includes('x plus one'));
      assert.ok(html.includes('Theorem 07'));
      const permalinks = elements.filter((element) => htmlAttribute(element, 'data-copy-block-link') !== undefined);
      assert.ok(permalinks.every((link) => link.tagName === 'a' && htmlAttribute(link, 'hidden') === undefined));
      for (const id of ['result', 'proof', 'sum-equation']) {
        assert.equal(permalinks.filter((link) => htmlAttribute(link, 'href') === `${prefix}learn/experts/#${id}`).length, 1);
      }
      const index: SearchEntry[] = JSON.parse(await readFile(path.join(directory, 'dist/search-index.json'), 'utf8'));
      const indexedBlock = (id: string) => index.find((result) => result.href === `${prefix}learn/experts/#${id}`);
      assert.match(indexedBlock('fixture-overview')!.text, /Inline math/);
      assert.doesNotMatch(indexedBlock('fixture-overview')!.text, /ExpertGame|Cross-note fixture|nested fixture/);
      assert.match(indexedBlock('deep-step')!.text, /nested fixture/);
      assert.match(indexedBlock('sum-equation')!.text, /The sum of x/);
      const pages = new Map([[`${prefix}learn/experts/`, elements]]);
      for (const result of index) {
        assert.ok(result.href.startsWith(`${prefix}learn/`));
        const [page, anchor] = result.href.split('#');
        if (!pages.has(page)) {
          const published = await readFile(path.join(directory, 'dist', page.slice(prefix.length), 'index.html'), 'utf8');
          pages.set(page, htmlElements(published));
        }
        if (anchor) {
          assert.ok(pages.get(page)!.some((element) => htmlAttribute(element, 'id') === decodeURIComponent(anchor)), result.href);
        }
      }
      const searchHtml = await readFile(path.join(directory, 'dist/search/index.html'), 'utf8');
      assert.ok(htmlElements(searchHtml).some((element) => htmlAttribute(element, 'data-note-search') === `${prefix}search-index.json`));
      const scripts = (await readdir(path.join(directory, 'dist/_astro'))).filter((file) => file.endsWith('.js'));
      assert.ok(scripts.length > 0);
      for (const script of scripts) {
        const source = await readFile(path.join(directory, 'dist/_astro', script), 'utf8');
        assert.doesNotMatch(source, /typst-ts|child_process|WebAssembly|New Computer Modern/);
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
