import { isElement } from './source.ts';
import type { ParsedNote } from './source.ts';
import type { Node, Parent } from 'unist';
import type { NoteRegistry } from '../../lib/notes/types.ts';
import type { SearchEntry } from '../../lib/search.ts';

const excluded = new Set(['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression', 'html']);

function children(node: Node): Node[] {
  return 'children' in node ? (node as Parent).children : [];
}

function textOf(node: Node): string {
  if (excluded.has(node.type) || (isElement(node) && node.name === 'BlockRef')) return '';
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('alt' in node && typeof node.alt === 'string') return node.alt;
  return children(node).map(textOf).join('');
}

/** Index authored prose by its nearest heading or permalink. Keep rendered anchor IDs. */
export function indexNote(
  note: ParsedNote,
  registry: NoteRegistry,
  href: string,
  headings: readonly { slug: string; text: string }[],
): SearchEntry[] {
  const entries: Array<SearchEntry & { parts: string[] }> = [];
  const { title, noteId } = note.metadata;
  const blocksAt = new Map(note.blocks.map((block) => [`${block.source.line}:${block.source.column}`, block]));
  const fragmentsById = new Map(note.fragments.filter((fragment) => fragment.id).map((fragment) => [fragment.id, fragment]));

  function entry(label: string, anchor?: string) {
    const result = { title: label, lecture: title, href: anchor ? `${href}#${encodeURIComponent(anchor)}` : href, text: '', parts: [] as string[] };
    entries.push(result);
    return result;
  }

  let section = entry(title);
  let headingIndex = 0;

  function visit(node: Node, parentBlock?: typeof section): void {
    if (excluded.has(node.type) || (isElement(node) && node.name === 'BlockRef')) return;
    if (node.type === 'heading') {
      const heading = headings[headingIndex++];
      if (!heading) return;
      if (!parentBlock) section = entry(heading.text, heading.slug);
      else parentBlock.parts.push(heading.text);
      return;
    }

    const start = node.position?.start;
    const sourceBlock = start && blocksAt.get(`${start.line}:${start.column}`);
    let blockEntry = parentBlock;
    if (sourceBlock) {
      const block = registry.blocks[`${noteId}/${sourceBlock.id}`];
      const label = block.title && block.title !== block.label ? `${block.label} · ${block.title}` : block.label;
      blockEntry = entry(label, block.id);
      const fragment = fragmentsById.get(block.id);
      if (fragment) {
        if (fragment.alt) blockEntry.parts.push(fragment.alt);
        if (fragment.tex && fragment.tex !== fragment.code) blockEntry.parts.push(fragment.tex);
        if (node.type !== 'code') blockEntry.parts.push(fragment.code);
      }
    }

    const destination = blockEntry ?? section;
    if (node.type === 'paragraph' || node.type === 'code' || children(node).length === 0) {
      const content = textOf(node);
      if (content) destination.parts.push(content);
      return;
    }
    for (const child of children(node)) visit(child, blockEntry);
  }

  for (const child of note.tree.children) visit(child);
  return entries.map(({ parts, ...result }) => ({ ...result, text: parts.join(' ').replace(/\s+/g, ' ').trim() }));
}
