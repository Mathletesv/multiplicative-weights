import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import { parseDocument } from 'yaml';
import Slugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';
import katex from 'katex';
import type { Node, Parent } from 'unist';
import type { Root } from 'mdast';
import type { BlockKind, BlockSpec, SourceLocation } from '../../lib/notes/types.ts';
import { assertId, diagnostic, reservedIds, validateNoteMetadata } from '../../lib/notes/registry.ts';
import type { RegistryNote } from '../../lib/notes/registry.ts';

export interface Element extends Parent {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: Array<{
    type: string;
    name?: string;
    value?: string | null | { type: string; value: string };
  }>;
}

export const components: Record<string, BlockKind | 'reference'> = {
  TheoremBlock: 'theorem', StatementBlock: 'theorem', NoteBlock: 'note',
  ProofBlock: 'proof', HintBlock: 'hint', DisclosureBlock: 'proof',
  TypstBlock: 'equation', BlockRef: 'reference',
};

export const componentPaths: Record<string, string> = {
  TheoremBlock: 'src/components/TheoremBlock.astro',
  ProofBlock: 'src/components/ProofBlock.astro',
  HintBlock: 'src/components/HintBlock.astro',
  ...Object.fromEntries(['StatementBlock', 'NoteBlock', 'DisclosureBlock', 'TypstBlock', 'TypstMath', 'BlockRef']
    .map((name) => [name, `src/components/blocks/${name}.astro`])),
};

export function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  if ('children' in node) for (const child of (node as Parent).children) walk(child, visit);
}

export const isElement = (node: Node): node is Element => node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement';
export const isMath = (node: Node): node is Node & { type: 'math' | 'inlineMath'; value: string } =>
  node.type === 'math' || node.type === 'inlineMath';
export const location = (file: string, node: Node): SourceLocation => ({
  file, line: node.position?.start.line ?? 1, column: node.position?.start.column ?? 1,
});

/** MDX wraps an inline slotted element in a paragraph; Astro needs a direct child. */
export function normalizeNamedSlots(element: Element): void {
  element.children = element.children.map((child) => {
    if (child.type !== 'paragraph') return child;
    const children = (child as Parent).children;
    if (children.length !== 1 || !isElement(children[0])) return child;
    const slot = children[0].attributes.find((attribute) => attribute.name === 'slot');
    if (slot?.value !== 'summary' && slot?.value !== 'alternative') return child;
    children[0].type = 'mdxJsxFlowElement';
    return children[0];
  });
}

export function literal(element: Element, name: string, source: SourceLocation): string | undefined {
  const attributes = element.attributes.filter((attr) => attr.name === name);
  if (attributes.length > 1) throw diagnostic(source, `Duplicate ${name} attribute.`);
  const attribute = attributes[0];
  if (!attribute) return undefined;
  if (typeof attribute.value !== 'string') throw diagnostic(source, `${name} must be a literal string.`);
  return attribute.value;
}

function explicitNumber(element: Element, source: SourceLocation): number | undefined {
  const attributes = element.attributes.filter((attribute) => attribute.name === 'number');
  if (attributes.length > 1) throw diagnostic(source, 'Duplicate number attribute.');
  const attr = attributes[0];
  if (!attr) return undefined;
  const text = typeof attr.value === 'string' ? attr.value : attr.value?.value;
  if (!text || !/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw diagnostic(source, 'number must be a literal positive integer, such as number={3}.');
  }
  return Number(text);
}

export interface TypstFragment {
  code: string;
  id?: string;
  alt?: string;
  tex?: string;
  mathml?: boolean;
  source: SourceLocation;
}

/** A small strict metadata grammar: name="JSON string" or name='literal string'. */
export function fenceMetadata(meta: string, source: SourceLocation): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  let remaining = meta.trim();
  while (remaining) {
    const match = /^([a-z]+)=("(?:[^"\\]|\\.)*"|'[^']*')(?:\s+|$)/.exec(remaining);
    if (!match) throw diagnostic(source, 'Typst metadata must use quoted id, alt, or tex values.');
    const [, key, quoted] = match;
    if (!['id', 'alt', 'tex'].includes(key)) throw diagnostic(source, `Unknown Typst metadata "${key}".`);
    if (Object.hasOwn(result, key)) throw diagnostic(source, `Duplicate Typst metadata "${key}".`);
    try { result[key] = quoted.startsWith('"') ? JSON.parse(quoted) : quoted.slice(1, -1); }
    catch { throw diagnostic(source, `Invalid quoted value for ${key}.`); }
    remaining = remaining.slice(match[0].length);
  }
  return result;
}

export interface ParsedNote extends RegistryNote {
  tree: Root;
  fragments: TypstFragment[];
  math?: TypstFragment[];
}

export function parseNote(file: string, source: string): ParsedNote {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!frontmatter) throw diagnostic({ file, line: 1, column: 1 }, 'Expected YAML frontmatter.');
  const yaml = parseDocument(frontmatter[1], { uniqueKeys: true });
  if (yaml.errors.length) throw diagnostic({ file, line: 1, column: 1 }, yaml.errors[0].message);
  const metadata = validateNoteMetadata(yaml.toJS(), file);
  const math = yaml.get('math');
  if (math !== undefined && math !== 'typst') {
    throw diagnostic({ file, line: 1, column: 1 }, 'Use math: typst to enable Typst for dollar-delimited math.');
  }
  // Preserve original line/column positions while preventing YAML from being parsed as MDX.
  const body = frontmatter[0].replace(/[^\n\r]/g, ' ') + source.slice(frontmatter[0].length);
  const tree = unified().use(remarkParse).use(remarkMdx).use(remarkMath).parse(body);
  const note: ParsedNote = {
    metadata, file, tree, blocks: [], references: [], fragments: [], legacyNumbers: [],
    math: math === 'typst' ? [] : undefined,
  };
  const ids = new Set(reservedIds);
  const slugger = new Slugger();
  function register(id: string, at: SourceLocation): void {
    assertId(id, at);
    if (ids.has(id)) throw diagnostic(at, `Duplicate or reserved page ID "${id}".`);
    ids.add(id);
  }
  walk(tree, (node) => {
    const at = location(file, node);
    if (note.math && isMath(node)) {
      const padding = node.type === 'math' ? ' ' : '';
      note.math.push({ code: '$' + padding + node.value + padding + '$', source: at });
    }
    if (node.type === 'heading') {
      // Final emitted HTML validation additionally covers headings transformed by other plugins.
      const id = slugger.slug(toString(node as Parameters<typeof toString>[0]));
      if (ids.has(id)) throw diagnostic(at, `Heading ID "${id}" collides with a page ID.`);
      ids.add(id);
    }
    if (node.type === 'code') {
      const code = node as { lang?: string; meta?: string; value: string } & Node;
      if (code.lang !== 'typst') return;
      const fields = fenceMetadata(code.meta ?? '', at);
      const fragment: TypstFragment = { code: code.value, ...fields, source: { ...at, line: at.line + 1, column: 1 } };
      validateAlternative(fragment, math === 'typst');
      note.fragments.push(fragment);
      if (fields.id !== undefined) {
        register(fields.id, at);
        note.blocks.push({ id: fields.id, kind: 'equation', source: at });
      }
    }
    if (!isElement(node) || !node.name) return;
    const component = Object.hasOwn(components, node.name) ? components[node.name] : undefined;
    if (!component) {
      if (/^[a-z]/.test(node.name)) {
        const id = literal(node, 'id', at);
        if (id !== undefined) register(id, at);
      }
      return;
    }
    normalizeNamedSlots(node);
    if (node.attributes.some((attribute) => attribute.type === 'mdxJsxExpressionAttribute')) {
      throw diagnostic(at, 'Spread props are not supported on note blocks or references.');
    }
    if (node.attributes.some((attribute) => attribute.name?.startsWith('__'))) {
      throw diagnostic(at, 'Attributes beginning with __ are reserved for the notes integration.');
    }
    if (component === 'reference') {
      const target = literal(node, 'target', at);
      if (!target) throw diagnostic(at, 'BlockRef needs a literal target.');
      note.references.push({ target, source: at });
      return;
    }
    let kind = component;
    if (node.name === 'StatementBlock') {
      const value = literal(node, 'kind', at) ?? 'theorem';
      if (!['theorem', 'lemma', 'proposition', 'corollary', 'definition', 'example', 'exercise'].includes(value)) {
        throw diagnostic(at, `Unknown statement kind "${value}".`);
      }
      kind = value as BlockKind;
    }
    if (node.name === 'DisclosureBlock') {
      const value = literal(node, 'kind', at) ?? 'proof';
      if (!['proof', 'hint'].includes(value)) throw diagnostic(at, `Unknown disclosure kind "${value}".`);
      kind = value as BlockKind;
    }
    const id = literal(node, 'id', at);
    if (id !== undefined) assertId(id, at);
    const number = explicitNumber(node, at);
    if (number !== undefined && !['TheoremBlock', 'StatementBlock'].includes(node.name)) {
      throw diagnostic(at, 'Only statements accept an explicit number.');
    }
    const openAttributes = node.attributes.filter((attribute) => attribute.name === 'open');
    if (openAttributes.length > 1) throw diagnostic(at, 'Duplicate open attribute.');
    const open = openAttributes[0];
    if (open && open.value !== null && !(typeof open.value === 'object' && ['true', 'false'].includes(open.value.value))) {
      throw diagnostic(at, 'open must be a literal boolean: open, open={true}, or open={false}.');
    }
    if (node.name === 'TypstBlock') {
      const code = literal(node, 'code', at);
      if (code === undefined) throw diagnostic(at, 'TypstBlock needs a literal code string.');
      const fragment = { code, id, alt: literal(node, 'alt', at), tex: literal(node, 'tex', at), source: at };
      const hasAlternativeSlot = node.children.some((child) => isElement(child) && child.attributes.some((attr) => attr.name === 'slot' && attr.value === 'alternative') && toString(child as Parameters<typeof toString>[0]).trim());
      validateAlternative(fragment, math === 'typst', hasAlternativeSlot);
      note.fragments.push(fragment);
    }
    // Keep the pre-existing unanchored proof and explicit-number theorem APIs working.
    if (!id && (node.name === 'ProofBlock' || (node.name === 'TheoremBlock' && number !== undefined))) {
      if (literal(node, 'for', at)) throw diagnostic(at, 'An associated disclosure needs an ID.');
      if (number !== undefined) note.legacyNumbers!.push({ number, source: at });
      return;
    }
    if (!id && node.name === 'TypstBlock') return;
    if (!id) throw diagnostic(at, `${node.name} needs a stable literal id.`);
    register(id, at);
    const spec: BlockSpec = { id, kind, number, title: literal(node, 'title', at), for: literal(node, 'for', at), source: at };
    note.blocks.push(spec);
  });
  return note;
}

function validateAlternative(fragment: TypstFragment, typstMath: boolean, hasSlot = false): void {
  if (!fragment.code.trim()) throw diagnostic(fragment.source, 'Typst block must not be empty.');
  if (!hasSlot && !fragment.alt?.trim() && !fragment.tex?.trim()) {
    if (!typstMath || fragment.alt !== undefined || fragment.tex !== undefined) {
      throw diagnostic(fragment.source, 'Typst needs a nonempty alt, tex, or alternative slot for accessibility.');
    }
    fragment.mathml = true;
  }
  if (!hasSlot && fragment.tex?.trim()) {
    try { katex.renderToString(fragment.tex, { displayMode: true, throwOnError: true }); }
    catch (error) { throw diagnostic(fragment.source, `Invalid accessible TeX equivalent: ${(error as Error).message}`); }
  }
}
