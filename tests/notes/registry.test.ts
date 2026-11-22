import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNote, fenceMetadata } from '../../src/integrations/notes/source.ts';
import { createRegistry, blockPath } from '../../src/lib/notes/registry.ts';

const note = (body: string, slug = 'experts', order = 1, extra = '') =>
  parseNote(`${slug}.mdx`, `---\norder: ${order}\nslug: ${slug}\ntitle: Fixture\n${extra}---\n\n${body}\n`);

test('forward references and cross-note references resolve before rendering', () => {
  const first = note('<BlockRef target="later" />\n\n<BlockRef target="games/result" />\n\n<TheoremBlock id="later">A</TheoremBlock>');
  const second = note('<TheoremBlock id="result">B</TheoremBlock>', 'games', 2);
  const registry = createRegistry([first, second]);
  assert.equal(registry.blocks['experts/later'].label, 'Theorem 1.1');
  assert.equal(registry.blocks['games/result'].label, 'Theorem 2.1');
  assert.equal(blockPath(registry.blocks['games/result']), 'learn/games/#result');
});

test('stable IDs survive renumbering and separate equation numbering', () => {
  const blockA = '<TheoremBlock id="a">A</TheoremBlock>';
  const blockB = '<StatementBlock kind="lemma" id="b">B</StatementBlock>';
  const equation = '```typst id="formula" alt="x squared"\n$ x^2 $\n```';
  const before = createRegistry([note(`${blockA}\n\n${blockB}\n\n${equation}`)]);
  const after = createRegistry([note(`${blockB}\n\n${blockA}\n\n${equation}`)]);
  assert.equal(before.blocks['experts/a'].number, '1.1');
  assert.equal(after.blocks['experts/a'].number, '1.2');
  assert.equal(blockPath(before.blocks['experts/a']), blockPath(after.blocks['experts/a']));
  assert.equal(after.blocks['experts/formula'].label, 'Equation (1.1)');
});

test('explicit legacy numbers reserve positions and retain their display', () => {
  const registry = createRegistry([note('<TheoremBlock id="old" number={1}>A</TheoremBlock>\n\n<TheoremBlock id="new">B</TheoremBlock>')]);
  assert.equal(registry.blocks['experts/old'].label, 'Theorem 01');
  assert.equal(registry.blocks['experts/new'].label, 'Theorem 1.2');
  assert.throws(() => createRegistry([note('<TheoremBlock id="a" number={2} />\n\n<TheoremBlock id="b" number={2} />')]), /Duplicate explicit number/);
});

test('proof and hint labels derive from valid associated statements', () => {
  const registry = createRegistry([note([
    '<TheoremBlock id="result" />', '<ProofBlock id="proof" for="result" />',
    '<StatementBlock kind="exercise" id="problem" />',
    '<HintBlock id="hint-a" for="problem" />', '<HintBlock id="hint-b" for="problem" />',
  ].join('\n\n'))]);
  assert.equal(registry.blocks['experts/proof'].label, 'Proof of Theorem 1.1');
  assert.equal(registry.blocks['experts/hint-b'].label, 'Hint 2 for Exercise 1.2');
  assert.throws(() => createRegistry([note('<TheoremBlock id="a" />\n\n<HintBlock id="hint" for="a" />')]), /Invalid hint association/);
  assert.throws(() => createRegistry([note('<ProofBlock id="a" for="a" />')]), /Invalid proof association/);
});

test('note identity can stay fixed while its route changes', () => {
  const registry = createRegistry([note('<TheoremBlock id="a" />', 'new-route', 1, 'noteId: experts\n')]);
  assert.equal(blockPath(registry.blocks['experts/a']), 'learn/new-route/#a');
});

test('unknown references and invalid or duplicate note metadata fail with source diagnostics', () => {
  assert.throws(() => createRegistry([note('<BlockRef target="missing" />')]), /experts\.mdx:7:1: Unknown block/);
  assert.throws(() => createRegistry([note(''), note('', 'games', 1)]), /Duplicate section order/);
  assert.throws(() => createRegistry([note(''), note('', 'games', 2, 'noteId: experts\n')]), /Duplicate note identity/);
  assert.throws(() => note('', 'bad/path'), /Invalid ID/);
  assert.equal(note('', 'overview', 0).metadata.order, 0);
  assert.throws(() => note('', 'experts', -1), /nonnegative integer/);
});

test('IDs collide across block, heading, HTML, and reserved layout namespaces', () => {
  for (const body of [
    '<TheoremBlock id="a" />\n\n<ProofBlock id="a" />',
    '## A\n\n<TheoremBlock id="a" />',
    '<TheoremBlock id="a" />\n\n## A',
    '<span id="a" />\n\n<NoteBlock id="a" />',
    '<TheoremBlock id="page-title" />',
  ]) assert.throws(() => note(body), /collid|Duplicate|reserved/);
});

test('referable component metadata must be static and cannot inject internal props', () => {
  for (const body of [
    '<TheoremBlock id={"a"} />', '<TheoremBlock {...props} />',
    '<TheoremBlock id="a" __note="wrong" />', '<BlockRef target={target} />',
    '<TheoremBlock />', '<StatementBlock id="a" kind="unknown" />',
  ]) assert.throws(() => note(body), /literal|Spread|reserved|stable|Unknown/);
});

test('Typst metadata parses quoted strings and requires an accessible equivalent', () => {
  const source = { file: 'fixture.mdx', line: 10, column: 1 };
  assert.equal(fenceMetadata('id="formula" alt="a \\"quoted\\" value"', source).alt, 'a "quoted" value');
  assert.equal(note('```typst tex="x^2"\n$ x^2 $\n```').fragments.length, 1);
  assert.throws(() => note('```typst\n$ x $\n```'), /accessibility/);
  assert.throws(() => note('```typst alt=" "\n$ x $\n```'), /accessibility/);
  assert.throws(() => note('```typst id="" alt="x"\n$ x $\n```'), /Invalid ID/);
  assert.throws(() => note("```typst tex='\\unknownfixturecommand'\n$ x $\n```"), /Invalid accessible TeX equivalent/);
  assert.throws(() => fenceMetadata('alt="x" alt="y"', source), /Duplicate/);
  assert.throws(() => fenceMetadata('width="10"', source), /Unknown/);
  assert.throws(() => fenceMetadata('alt=x', source), /quoted/);
});

test('source listings and code examples do not register phantom blocks', () => {
  const parsed = note('```mdx\n<TheoremBlock id="a" />\n```\n\n```typst-source\n$ x $\n```');
  assert.deepEqual(parsed.blocks, []);
  assert.deepEqual(parsed.fragments, []);
});

test('named MDX alternatives are normalized through paragraph wrappers and cannot be empty', () => {
  assert.equal(note('<TypstBlock code="$ x $">\n  <span slot="alternative">x</span>\n</TypstBlock>').fragments.length, 1);
  assert.throws(() => note('<TypstBlock code="$ x $">\n  <span slot="alternative" />\n</TypstBlock>'), /accessibility/);
});

test('unanchored legacy numbers reserve their positions and open is a boolean', () => {
  const registry = createRegistry([note('<TheoremBlock number={1} />\n\n<TheoremBlock id="a" />')]);
  assert.equal(registry.blocks['experts/a'].number, '1.2');
  assert.throws(() => note('<ProofBlock open="false" />'), /literal boolean/);
  assert.throws(() => note('<ProofBlock open open={false} />'), /Duplicate open/);
  assert.throws(() => note('<TheoremBlock number={1} number={2} />'), /Duplicate number/);
});
