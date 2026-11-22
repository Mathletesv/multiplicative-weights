import { parseFragment } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';

/** Structural guard for rendered alternatives; the author still verifies equivalence. */
export function hasAccessibleContent(html: string): boolean {
  function visit(node: DefaultTreeAdapterMap['node']): boolean {
    if (node.nodeName === '#text') return !!(node as DefaultTreeAdapterMap['textNode']).value.trim();
    if ('tagName' in node) {
      const attribute = (name: string) => node.attrs.find((item) => item.name === name)?.value;
      if (['script', 'style', 'template'].includes(node.tagName) || attribute('aria-hidden') === 'true' || attribute('hidden') !== undefined) return false;
      if (attribute('aria-label')?.trim() || (node.tagName === 'img' && attribute('alt')?.trim())) return true;
    }
    return 'childNodes' in node && node.childNodes.some(visit);
  }
  return visit(parseFragment(html));
}
