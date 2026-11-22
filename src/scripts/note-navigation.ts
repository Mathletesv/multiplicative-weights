import { installProofSteps } from './proof-steps';

/** Enhance ordinary anchors and native disclosures; never owns the document's content. */
export function installNoteNavigation(document: Document, window: Window): () => void {
  let frame = 0;
  let statusTimeout = 0;
  const copyStatus = document.querySelector<HTMLElement>('[data-copy-status]');
  const proofs = installProofSteps(document);

  function targetFor(hash: string): HTMLElement | null {
    if (!hash) return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
  }

  function reveal(hash: string, focus: boolean): void {
    const target = targetFor(hash);
    if (!target) return;
    proofs.revealThrough(target);
    const ancestors: HTMLDetailsElement[] = [];
    for (let node: HTMLElement | null = target; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') ancestors.push(node as HTMLDetailsElement);
    }
    ancestors.reverse().forEach((details) => { details.open = true; });
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      if (focus) {
        const destination = target.tagName === 'DETAILS' ? target.querySelector('summary') ?? target : target;
        if (!destination.hasAttribute('tabindex') && !destination.matches('a, button, input, select, textarea, summary')) {
          destination.setAttribute('tabindex', '-1');
        }
        destination.focus({ preventScroll: true });
      }
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }

  function followFragment(hash: string): void {
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    reveal(hash, true);
  }

  function showStatus(message: string): void {
    if (!copyStatus) return;
    window.clearTimeout(statusTimeout);
    copyStatus.textContent = message;
    statusTimeout = window.setTimeout(() => { copyStatus.textContent = ''; }, 2500);
  }

  async function copyPermalink(clipboard: Clipboard, url: URL, local: boolean): Promise<void> {
    try {
      await clipboard.writeText(url.href);
      showStatus('Link copied.');
    } catch {
      if (local) {
        followFragment(url.hash);
        showStatus('Copy failed. Link opened.');
      } else {
        window.location.assign(url.href);
      }
    }
  }

  function onHashChange(): void { reveal(window.location.hash, false); }
  function onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const element = event.target instanceof Element ? event.target : null;
    const link = element?.closest<HTMLAnchorElement>('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, window.location.href);
    const { origin, pathname, search } = window.location;
    const local = url.origin === origin && url.pathname === pathname && url.search === search && targetFor(url.hash) !== null;
    const clipboard = window.navigator.clipboard;
    if (link.hasAttribute('data-copy-block-link') && typeof clipboard?.writeText === 'function') {
      event.preventDefault();
      void copyPermalink(clipboard, url, local);
      return;
    }
    if (!local) return;
    event.preventDefault();
    followFragment(url.hash);
  }

  const printStates = new Map<HTMLDetailsElement, boolean>();
  function beforePrint(): void {
    for (const details of document.querySelectorAll<HTMLDetailsElement>('details[data-note-disclosure]')) {
      if (!printStates.has(details)) printStates.set(details, details.open);
      details.open = true;
    }
  }
  function afterPrint(): void {
    for (const [details, open] of printStates) details.open = open;
    printStates.clear();
  }
  if (typeof window.navigator.clipboard?.writeText === 'function') {
    document.querySelectorAll<HTMLAnchorElement>('[data-copy-block-link]').forEach((link) => { link.title = 'Copy link'; });
  }
  document.addEventListener('click', onClick);
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);
  reveal(window.location.hash, false);
  return () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(statusTimeout);
    document.removeEventListener('click', onClick);
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('beforeprint', beforePrint);
    window.removeEventListener('afterprint', afterPrint);
    afterPrint();
    proofs.destroy();
  };
}
