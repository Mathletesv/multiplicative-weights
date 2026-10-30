import type { MDXInstance } from 'astro';
import { sitePath } from '../lib/paths';

export interface LectureFrontmatter {
  order: number;
  slug: string;
  title: string;
}

export type Lecture = MDXInstance<LectureFrontmatter>;

const modules = import.meta.glob<Lecture>('../content/lectures/*.mdx', {
  eager: true,
});

export const lectures = Object.values(modules).sort(
  (a, b) => a.frontmatter.order - b.frontmatter.order,
);

export const lecturePath = (lecture: Lecture): string =>
  sitePath(`learn/${lecture.frontmatter.slug}/`);

export const lectureNumber = (lecture: Lecture): string =>
  String(lecture.frontmatter.order).padStart(2, '0');
