export const statementKinds = [
  'theorem', 'lemma', 'proposition', 'corollary', 'definition', 'example', 'exercise',
] as const;

export type StatementKind = (typeof statementKinds)[number];
export type BlockKind = StatementKind | 'equation' | 'proof' | 'hint' | 'note';

/** Renderer coordinate size; presentation scales it to the body typography token. */
export const typstPixelsPerEm = 20;

export interface NoteMetadata {
  order: number;
  slug: string;
  title: string;
  /** May stay fixed when the route slug changes. Defaults to slug. */
  noteId: string;
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface BlockSpec {
  id: string;
  kind: BlockKind;
  title?: string;
  number?: number;
  for?: string;
  source: SourceLocation;
}

export interface ReferenceSpec {
  target: string;
  source: SourceLocation;
}

export interface BlockRecord extends Omit<BlockSpec, 'number' | 'for'> {
  key: string;
  noteId: string;
  slug: string;
  number?: string;
  label: string;
  for?: string;
}

export interface NoteRegistry {
  notes: Record<string, NoteMetadata>;
  blocks: Record<string, BlockRecord>;
}

export interface TypstAsset {
  fileName: string;
  /** CSS pixel dimensions, converted from Typst's point coordinates. */
  width: number;
  height: number;
}
