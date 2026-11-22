import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TypstCompiler } from '../../src/integrations/notes/typst.ts';

const ink = { light: '#202522', dark: '#e8ede7' };

test('Typst compiles tight transparent SVGs with deterministic assets and theme invalidation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'notes-typst-test-'));
  try {
    const compiler = new TypstCompiler(root, ink);
    const fragment = { code: '$ sum_(i=1)^n x_i / 2 $', alt: 'Fixture', source: { file: 'fixture.mdx', line: 20, column: 1 } };
    const [a, b] = await Promise.all([compiler.compile(fragment), compiler.compile(fragment)]);
    assert.equal(a.fileName, b.fileName);
    assert.ok(a.width > 0 && a.width < 500);
    assert.ok(a.height > 0 && a.height < 200);
    assert.ok(a.svg.includes('<svg'));
    assert.match(a.svg, /<style>@media \(prefers-color-scheme: dark\)/);
    assert.match(a.svg, /\[fill="#202522" i\] \{ fill: #e8ede7; \}/);
    assert.equal((await new TypstCompiler(root, ink).compile(fragment)).svg, a.svg);
    assert.notEqual((await new TypstCompiler(root, { ...ink, light: '#000000' }).compile(fragment)).fileName, a.fileName);
    assert.notEqual((await new TypstCompiler(root, { ...ink, dark: '#ffffff' }).compile(fragment)).fileName, a.fileName);
    assert.equal((await readdir(root)).filter((file) => file.startsWith('compile-')).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('compiler errors map to original MDX lines and imports are rejected', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'notes-typst-error-'));
  try {
    const compiler = new TypstCompiler(root, ink);
    const source = { file: 'fixture.mdx', line: 24, column: 1 };
    await assert.rejects(compiler.compile({ code: '$ unknownfixturecommand $', alt: 'Fixture', source }), /fixture\.mdx:24:/);
    await assert.rejects(compiler.compile({ code: '#import "missing.typ"', alt: 'Fixture', source }), /imports\/includes are unsupported/);
    assert.equal((await readdir(root)).filter((file) => file.startsWith('compile-')).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
