import assert from 'node:assert/strict';
import test from 'node:test';
import { findNotes, searchExcerpt } from '../../src/lib/search.ts';
import type { SearchEntry } from '../../src/lib/search.ts';

const lecture = 'Learning From Experts';
const href = '/learn/experts/';
const entries: SearchEntry[] = [
  { lecture, href, title: lecture, text: '' },
  { lecture, href: `${href}#mistake`, title: 'Counting mistakes', text: 'Follow the majority vote.' },
  { lecture, href: `${href}#vote`, title: 'Majority Vote', text: 'The experts make predictions.' },
  { lecture, href: `${href}#cafe`, title: 'Café', text: 'Fixture text.' },
];

test('search prioritizes matching titles and handles partial and accent-free terms', () => {
  assert.deepEqual(findNotes(entries, 'MAJOR vote'), [entries[2], entries[1]]);
  assert.deepEqual(findNotes(entries, 'cafe'), [entries[3]]);
});

test('search requires every term and uses the lecture name to supply context', () => {
  assert.deepEqual(findNotes(entries, 'learning'), [entries[0]]);
  assert.deepEqual(findNotes(entries, 'learning mistake'), [entries[1]]);
  assert.deepEqual(findNotes(entries, 'vote restaurant'), []);
  assert.deepEqual(findNotes(entries, '— ?'), []);
});

test('search excerpts include a match deep in the text and truncate at word boundaries', () => {
  const text = `${'beginning '.repeat(30)}Café ${'ending '.repeat(30)}last`;
  assert.equal(searchExcerpt(text, 'cafe'), `…${'beginning '.repeat(5)}Café ${'ending '.repeat(18).trimEnd()}…`);
  assert.equal(searchExcerpt('A short excerpt.', 'title'), 'A short excerpt.');
});
