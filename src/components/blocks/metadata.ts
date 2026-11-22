import { registry } from 'virtual:note-registry';
import { resolveBlock } from '../../lib/notes/registry.ts';
import type { BlockRecord } from '../../lib/notes/types.ts';

export interface BlockIdentity {
  id?: string;
  /** Injected by the MDX transform; authors supply local IDs only. */
  __note?: string;
}

export function blockMetadata({ id, __note }: BlockIdentity): BlockRecord | undefined {
  if (!id) return;
  if (!__note) throw new Error(`Block "${id}" needs notes MDX context. Use note components inside src/content/lectures/.`);
  return resolveBlock(registry, id, __note, { file: `note ${__note}`, line: 1, column: 1 });
}

export function referenceMetadata(target: string, noteId = ''): BlockRecord {
  return resolveBlock(registry, target, noteId, { file: `reference in ${noteId}`, line: 1, column: 1 });
}
