/// <reference types="astro/client" />

declare module 'virtual:note-registry' {
  export const registry: import('./lib/notes/types.ts').NoteRegistry;
}
