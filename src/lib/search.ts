export interface SearchEntry {
  title: string;
  lecture: string;
  href: string;
  text: string;
}

const words = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu;

function fold(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function tokens(text: string): string[] {
  return fold(text).match(words) ?? [];
}

export function findNotes(entries: readonly SearchEntry[], query: string): SearchEntry[] {
  const queryTokens = tokens(query);
  const phrase = queryTokens.join(' ');
  const terms = [...new Set(queryTokens)];
  if (!terms.length) return [];

  return entries.flatMap((entry) => {
    const title = tokens(entry.title);
    const body = tokens(entry.text);
    const lecture = tokens(entry.lecture);
    const titlePhrase = title.join(' ');
    let score = titlePhrase === phrase ? 36 : titlePhrase.startsWith(phrase) ? 16 : 0;
    let matchesEntry = false;
    for (const term of terms) {
      // Prefix matches support typing, while exact title words rank above body text.
      if (title.includes(term)) score += 12;
      else if (title.some((word) => word.startsWith(term))) score += 7;
      else if (body.includes(term)) score += 4;
      else if (body.some((word) => word.startsWith(term))) score += 2;
      else if (lecture.some((word) => word.startsWith(term))) {
        score += 1;
        continue;
      } else return [];
      matchesEntry = true;
    }
    return matchesEntry ? [{ entry, score }] : [];
  }).sort((a, b) => b.score - a.score).map(({ entry }) => entry);
}

export function searchExcerpt(text: string, query: string): string {
  const matches = [...text.matchAll(words)];
  const terms = tokens(query);
  const match = matches.findIndex(([word]) => terms.includes(fold(word)));
  const prefix = match < 0
    ? matches.findIndex(([word]) => terms.some((term) => fold(word).startsWith(term)))
    : match;
  const first = Math.max(0, prefix - 5);
  const last = matches[first + 24];
  const start = first === 0 ? 0 : matches[first].index;
  const excerpt = text.slice(start, last?.index).trimEnd();
  return `${first > 0 ? '…' : ''}${excerpt}${last ? '…' : ''}`;
}
