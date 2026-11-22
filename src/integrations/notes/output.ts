import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import type { NoteRegistry } from '../../lib/notes/types.ts';
import { blockPath } from '../../lib/notes/registry.ts';

type HtmlNode = DefaultTreeAdapterMap['node'];
export function htmlElements(html: string): DefaultTreeAdapterMap['element'][] {
  const elements: DefaultTreeAdapterMap['element'][] = [];
  function visit(node: HtmlNode): void {
    if ('tagName' in node) elements.push(node);
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(parse(html));
  return elements;
}

export const htmlAttribute = (element: DefaultTreeAdapterMap['element'], name: string): string | undefined =>
  element.attrs.find((attribute) => attribute.name === name)?.value;

/** Validate actual emitted anchors as well as the source-level registry. */
export async function validateOutput(directory: string, base: string, registry: NoteRegistry): Promise<void> {
  const pages = new Map<string, Map<string, number>>();
  const links: Array<{ page: string; href: string }> = [];
  async function visit(directoryPath: string): Promise<void> {
    for (const item of await readdir(directoryPath, { withFileTypes: true })) {
      const file = path.join(directoryPath, item.name);
      if (item.isDirectory()) await visit(file);
      else if (file.endsWith('.html')) {
        const relative = path.relative(directory, file).split(path.sep).join('/');
        const route = relative.replace(/index\.html$/, '');
        const ids = new Map<string, number>();
        for (const element of htmlElements(await readFile(file, 'utf8'))) {
          const id = htmlAttribute(element, 'id');
          if (id !== undefined) ids.set(id, (ids.get(id) ?? 0) + 1);
          if (htmlAttribute(element, 'data-block-ref') !== undefined) {
            links.push({ page: route, href: htmlAttribute(element, 'href') ?? '' });
          }
        }
        for (const [id, count] of ids) if (count !== 1) throw new Error(`${relative}: duplicate emitted ID "${id}" (${count} instances).`);
        pages.set(route, ids);
      }
    }
  }
  await visit(directory);
  const prefix = `${base.replace(/\/$/, '')}/`;
  function assertDestination(href: string, page: string): void {
    const url = new URL(href, `https://notes.invalid${prefix}${page}`);
    if (url.origin !== 'https://notes.invalid' || !url.pathname.startsWith(prefix)) throw new Error(`Invalid generated note link "${href}".`);
    const route = url.pathname.slice(prefix.length);
    const id = decodeURIComponent(url.hash.slice(1));
    if (pages.get(route)?.get(id) !== 1) throw new Error(`Broken generated note link "${href}" from ${page}.`);
  }
  for (const block of Object.values(registry.blocks)) assertDestination(prefix + blockPath(block), block.source.file);
  for (const link of links) assertDestination(link.href, link.page);
}
