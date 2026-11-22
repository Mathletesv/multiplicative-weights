import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { mkdtemp, mkdir, readdir, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import type { AstroConfig, AstroIntegration } from 'astro';
import type { NoteRegistry } from '../../src/lib/notes/types.ts';
import notesSystem from '../../src/integrations/notes/index.ts';

interface PluginHarness {
  load(id: string): Promise<string>;
  configureServer(server: unknown): void;
}

type AssetMiddleware = (
  req: { url: string; originalUrl: string },
  res: { setHeader(name: string, value: string): void; end(body?: string): void },
  next: () => void,
) => Promise<void>;

test('development serves Typst and updates its registry as notes change', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'notes-development-test-'));
  const content = path.join(root, 'src/content/lectures');
  const tokens = path.join(root, 'src/styles/tokens.css');
  let plugin: PluginHarness | undefined;
  const body = (slug: string, order: number, text: string) => `---\norder: ${order}\nslug: ${slug}\ntitle: Fixture\n---\n${text}\n`;
  const watcher = Object.assign(new EventEmitter(), { add() {} });
  const messages = new EventEmitter();
  const httpServer = new EventEmitter();
  let invalidations = 0;
  try {
    await mkdir(content, { recursive: true });
    await mkdir(path.dirname(tokens), { recursive: true });
    await writeFile(tokens, ':root { --color-ink-light: #202522; --color-ink-dark: #e8ede7; }');
    const experts = path.join(content, 'experts.mdx');
    const games = path.join(content, 'games.mdx');
    await writeFile(experts, body('experts', 1, '<TheoremBlock id="a" />\n\n```typst alt="x squared"\n$ x^2 $\n```'));
    await writeFile(games, body('games', 2, '<BlockRef target="experts/a" />'));
    const system = notesSystem();
    const config = {
      root: pathToFileURL(root + '/'), srcDir: pathToFileURL(path.join(root, 'src') + '/'), base: '/prefix',
    } as AstroConfig;
    type Setup = Parameters<NonNullable<AstroIntegration['hooks']['astro:config:setup']>>[0];
    await system.integration.hooks['astro:config:setup']!({
      config,
      updateConfig(update) {
        plugin = update.vite?.plugins?.[0] as unknown as PluginHarness;
        return config;
      },
    } as Setup);
    assert.ok(plugin);
    let assetMiddleware: AssetMiddleware | undefined;
    plugin.configureServer({
      watcher, httpServer,
      moduleGraph: { invalidateAll() { invalidations++; } },
      ws: { send(message: unknown) { messages.emit('message', message); } },
      middlewares: { use(middleware: AssetMiddleware) { assetMiddleware = middleware; } },
    });
    await t.test('serves the equation after Astro strips the configured base from the request URL', async () => {
      assert.ok(assetMiddleware);
      const [file] = await readdir(path.join(root, '.astro/notes/typst'));
      const url = `/_notes/typst/${file}`;
      const headers = new Map<string, string>();
      let svg: string | undefined;
      await assetMiddleware({ url, originalUrl: `/prefix${url}` }, {
        setHeader(name, value) { headers.set(name, value); },
        end(body) { svg = body; },
      }, () => assert.fail('The browser request fell through to Astro page routing'));
      assert.equal(headers.get('Content-Type'), 'image/svg+xml');
      assert.match(svg ?? '', /^<svg\b/);
    });
    async function snapshot(): Promise<NoteRegistry> {
      return JSON.parse((await plugin!.load('\0virtual:note-registry')).replace(/^export const registry = /, '').replace(/;$/, ''));
    }
    async function changed(event: string, file: string): Promise<{ type: string }> {
      const message = once(messages, 'message', { signal: AbortSignal.timeout(5000) });
      watcher.emit(event, file);
      return (await message)[0];
    }
    assert.equal((await snapshot()).blocks['experts/a'].label, 'Theorem 1.1');
    await writeFile(experts, body('experts', 1, '<TheoremBlock id="b" />'));
    assert.equal((await changed('change', experts)).type, 'error');
    await assert.rejects(snapshot(), /Unknown block "experts\/a"/);
    await writeFile(games, body('games', 2, '<BlockRef target="experts/b" />'));
    assert.equal((await changed('change', games)).type, 'full-reload');
    assert.ok((await snapshot()).blocks['experts/b']);
    const added = path.join(content, 'added.mdx');
    await writeFile(added, body('added', 3, '<TheoremBlock id="c" />'));
    assert.equal((await changed('add', added)).type, 'full-reload');
    assert.ok((await snapshot()).blocks['added/c']);
    await rm(added);
    assert.equal((await changed('unlink', added)).type, 'full-reload');
    assert.equal((await snapshot()).blocks['added/c'], undefined);
    await writeFile(tokens, ':root { --color-ink-light: #202522; --color-ink-dark: #ffffff; }');
    assert.equal((await changed('change', tokens)).type, 'full-reload');
    assert.equal(invalidations, 5);
    httpServer.emit('close');
    assert.equal(watcher.listenerCount('change'), 0);
  } finally {
    httpServer.emit('close');
    await rm(root, { recursive: true, force: true });
  }
});
