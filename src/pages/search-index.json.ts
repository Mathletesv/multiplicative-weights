import type { APIRoute } from 'astro';
import { registry } from 'virtual:note-registry';
import { lecturePath, lectures } from '../data/course';
import { indexNote } from '../integrations/notes/search.ts';
import { parseNote } from '../integrations/notes/source.ts';

const sources = import.meta.glob<string>('../content/lectures/*.mdx', { eager: true, query: '?raw', import: 'default' });

export const GET: APIRoute = () => {
  const notes = Object.entries(sources).map(([file, source]) => parseNote(file, source));
  const bySlug = new Map(notes.map((note) => [note.metadata.slug, note]));
  const entries = lectures.flatMap((lecture) => {
    const note = bySlug.get(lecture.frontmatter.slug);
    if (!note) throw new Error(`Search source missing for ${lecture.frontmatter.slug}`);
    return indexNote(note, registry, lecturePath(lecture), lecture.getHeadings());
  });
  return Response.json(entries);
};
