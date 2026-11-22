import { findNotes, searchExcerpt } from '../lib/search';
import type { SearchEntry } from '../lib/search';

export function installNoteSearch(root: HTMLElement): void {
  const indexUrl = root.dataset.noteSearch;
  const form = root.querySelector('form');
  const input = form?.querySelector('input');
  const status = root.querySelector('[data-search-status]');
  const list = root.querySelector('[data-search-results]');
  const template = root.querySelector<HTMLTemplateElement>('[data-search-result]');
  if (!indexUrl || !form || !input || !status || !list || !template) return;

  let index: Promise<SearchEntry[]> | undefined;
  let request = 0;

  const loadIndex = () => {
    index ??= fetch(indexUrl).then(async (response) => {
      if (!response.ok) throw new Error('Search index unavailable');
      return await response.json() as SearchEntry[];
    }).catch((error) => {
      index = undefined;
      throw error;
    });
    return index;
  };

  const readQuery = () => {
    input.value = new URL(location.href).searchParams.get('q')?.slice(0, input.maxLength) ?? '';
  };

  const update = async (updateUrl: boolean) => {
    const revision = ++request;
    const query = input.value.trim();
    if (updateUrl) {
      const url = new URL(location.href);
      if (query) url.searchParams.set('q', query);
      else url.searchParams.delete('q');
      history.replaceState(history.state, '', url);
    }
    list.replaceChildren();
    if (!query) {
      status.textContent = '';
      return;
    }

    status.textContent = 'Searching…';
    try {
      const entries = await loadIndex();
      if (revision !== request) return;
      const results = findNotes(entries, query);
      status.textContent = results.length === 0 ? 'No matching notes.' : `${results.length} ${results.length === 1 ? 'result' : 'results'}`;
      for (const entry of results) {
        const row = template.content.cloneNode(true) as DocumentFragment;
        const link = row.querySelector<HTMLAnchorElement>('[data-result-link]')!;
        link.href = entry.href;
        link.textContent = entry.title;
        row.querySelector('[data-result-lecture]')!.textContent = entry.lecture === entry.title ? '' : entry.lecture;
        row.querySelector('[data-result-excerpt]')!.textContent = searchExcerpt(entry.text, query);
        list.append(row);
      }
    } catch {
      if (revision === request) status.textContent = 'Search could not load. Try again.';
    }
  };

  input.addEventListener('input', () => { void update(true); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void update(true);
  });
  window.addEventListener('popstate', () => {
    readQuery();
    void update(false);
  });
  readQuery();
  void update(false);
}
