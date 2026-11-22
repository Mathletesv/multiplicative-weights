import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateOutput } from '../../src/integrations/notes/output.ts';
import { createRegistry } from '../../src/lib/notes/registry.ts';
import { parseNote } from '../../src/integrations/notes/source.ts';

test('final HTML validation catches missing anchors and duplicate IDs under a hosting base', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'notes-output-test-'));
  try {
    const registry = createRegistry([parseNote('experts.mdx', '---\norder: 1\nslug: experts\ntitle: Fixture\n---\n<TheoremBlock id="a" />')]);
    const folder = path.join(root, 'learn/experts');
    await mkdir(folder, { recursive: true });
    const file = path.join(folder, 'index.html');
    await writeFile(file, '<section id="a"></section><a data-block-ref href="/prefix/learn/experts/#a">A</a>');
    await validateOutput(root, '/prefix', registry);
    await writeFile(file, '<section id="a"></section><a data-block-ref href="#missing">A</a>');
    await assert.rejects(validateOutput(root, '/prefix', registry), /Broken generated note link/);
    await writeFile(file, '<section id="a"></section><div id="a"></div>');
    await assert.rejects(validateOutput(root, '/prefix', registry), /duplicate emitted ID/);
    await writeFile(file, '<section></section>');
    await assert.rejects(validateOutput(root, '/', registry), /Broken generated note link/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
