import { statementKinds } from './types.ts';
import type { BlockRecord, BlockSpec, NoteMetadata, NoteRegistry, ReferenceSpec, SourceLocation } from './types.ts';

const identifier = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const reservedIds = new Set(['main-content', 'page-title']);

export function diagnostic(source: SourceLocation, message: string): Error {
  return new Error(`${source.file}:${source.line}:${source.column}: ${message}`);
}

export function assertId(id: string, source: SourceLocation): void {
  if (!identifier.test(id)) throw diagnostic(source, `Invalid ID "${id}"; use lowercase words separated by hyphens.`);
}

export function validateNoteMetadata(value: unknown, file: string): NoteMetadata {
  const source = { file, line: 1, column: 1 };
  if (!value || typeof value !== 'object') throw diagnostic(source, 'Expected note frontmatter.');
  const data = value as Record<string, unknown>;
  if (!Number.isSafeInteger(data.order) || Number(data.order) < 0) throw diagnostic(source, 'order must be a nonnegative integer.');
  if (typeof data.slug !== 'string') throw diagnostic(source, 'slug must be a string.');
  if (typeof data.title !== 'string' || !data.title.trim()) throw diagnostic(source, 'title must be a nonempty string.');
  const noteId = data.noteId ?? data.slug;
  if (typeof noteId !== 'string') throw diagnostic(source, 'noteId must be a string.');
  assertId(data.slug, source);
  assertId(noteId, source);
  return { order: Number(data.order), slug: data.slug, title: data.title, noteId };
}

export function targetKey(target: string, noteId: string, source: SourceLocation): string {
  const parts = target.split('/');
  if (parts.length === 1) parts.unshift(noteId);
  if (parts.length !== 2) throw diagnostic(source, `Invalid reference "${target}"; use note-id/block-id.`);
  parts.forEach((part) => assertId(part, source));
  return parts.join('/');
}

export function resolveBlock(registry: NoteRegistry, target: string, noteId: string, source: SourceLocation): BlockRecord {
  const key = targetKey(target, noteId, source);
  const block = registry.blocks[key];
  if (!block) throw diagnostic(source, `Unknown block "${key}".`);
  return block;
}

export const blockPath = (block: BlockRecord): string => `learn/${block.slug}/#${block.id}`;

export interface RegistryNote {
  metadata: NoteMetadata;
  file: string;
  blocks: BlockSpec[];
  references: ReferenceSpec[];
  legacyNumbers?: Array<{ number: number; source: SourceLocation }>;
}

/** Allocate in source order, before resolving anything. Never depends on render order. */
export function createRegistry(notes: RegistryNote[]): NoteRegistry {
  notes = [...notes].sort((a, b) => a.metadata.order - b.metadata.order || a.file.localeCompare(b.file));
  const registry: NoteRegistry = { notes: Object.create(null), blocks: Object.create(null) };
  const orders = new Set<number>();
  const slugs = new Set<string>();
  for (const note of notes) {
    const meta = note.metadata;
    const source = { file: note.file, line: 1, column: 1 };
    if (registry.notes[meta.noteId]) throw diagnostic(source, `Duplicate note identity "${meta.noteId}".`);
    if (orders.has(meta.order)) throw diagnostic(source, `Duplicate section order ${meta.order}.`);
    if (slugs.has(meta.slug)) throw diagnostic(source, `Duplicate route slug "${meta.slug}".`);
    orders.add(meta.order);
    slugs.add(meta.slug);
    registry.notes[meta.noteId] = meta;

    const numbered = (kind: string) => (statementKinds as readonly string[]).includes(kind);
    const reserved = new Set<number>();
    for (const legacy of note.legacyNumbers ?? []) {
      if (reserved.has(legacy.number)) throw diagnostic(legacy.source, `Duplicate explicit number ${legacy.number}.`);
      reserved.add(legacy.number);
    }
    for (const spec of note.blocks) {
      if (spec.number === undefined) continue;
      if (!numbered(spec.kind) || !Number.isSafeInteger(spec.number) || spec.number < 1) {
        throw diagnostic(spec.source, 'Explicit number must be a positive integer on a statement.');
      }
      if (reserved.has(spec.number)) throw diagnostic(spec.source, `Duplicate explicit number ${spec.number}.`);
      reserved.add(spec.number);
    }
    let statementIndex = 1;
    let equationIndex = 1;
    for (const spec of note.blocks) {
      assertId(spec.id, spec.source);
      if (reservedIds.has(spec.id)) throw diagnostic(spec.source, `ID "${spec.id}" is reserved by the page layout.`);
      const key = `${meta.noteId}/${spec.id}`;
      if (registry.blocks[key]) throw diagnostic(spec.source, `Duplicate block ID "${spec.id}".`);
      let number: string | undefined;
      if (numbered(spec.kind)) {
        if (spec.number !== undefined) {
          // Preserve the original TheoremBlock number={n} display contract.
          number = String(spec.number).padStart(2, '0');
        } else {
          while (reserved.has(statementIndex)) statementIndex++;
          number = `${meta.order}.${statementIndex++}`;
        }
      } else if (spec.kind === 'equation') {
        number = `${meta.order}.${equationIndex++}`;
      }
      const kindLabel = spec.kind[0].toUpperCase() + spec.kind.slice(1);
      const label = spec.kind === 'note' ? spec.title ?? 'Block'
        : spec.kind === 'equation' ? `Equation (${number})`
        : number ? `${kindLabel} ${number}` : kindLabel;
      registry.blocks[key] = { ...spec, key, noteId: meta.noteId, slug: meta.slug, number, label };
    }
  }

  const hintCounts = new Map<string, number>();
  for (const note of notes) {
    for (const spec of note.blocks) {
      if (spec.for === undefined) continue;
      const block = registry.blocks[`${note.metadata.noteId}/${spec.id}`];
      const parent = resolveBlock(registry, spec.for, note.metadata.noteId, spec.source);
      const proofKinds = ['theorem', 'lemma', 'proposition', 'corollary'];
      if ((block.kind === 'proof' && !proofKinds.includes(parent.kind)) ||
          (block.kind === 'hint' && parent.kind !== 'exercise') ||
          !['proof', 'hint'].includes(block.kind)) {
        throw diagnostic(spec.source, `Invalid ${block.kind} association to ${parent.kind} "${parent.key}".`);
      }
      block.for = parent.key;
      if (block.kind === 'proof') block.label = `Proof of ${parent.label}`;
      else {
        const ordinal = (hintCounts.get(parent.key) ?? 0) + 1;
        hintCounts.set(parent.key, ordinal);
        block.label = `Hint ${ordinal} for ${parent.label}`;
      }
    }
    for (const ref of note.references) resolveBlock(registry, ref.target, note.metadata.noteId, ref.source);
  }
  return registry;
}
