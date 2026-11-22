import { nextStepKey, shortcutTarget } from './keyboard-shortcuts';

interface ProofSteps {
  revealThrough(target: Element): void;
  restore(): void;
}

function substeps(block: Element): NodeListOf<Element> | undefined {
  if (block.matches('ol, ul')) return block.querySelectorAll(':scope > li');
  if (block.hasAttribute('data-proof-math')) {
    return block.querySelectorAll('math > mtable.multiline-equation > mtr');
  }
}

function initialize(controls: HTMLElement, signal: AbortSignal): ProofSteps | undefined {
  const disclosure = controls.closest<HTMLDetailsElement>('details');
  const body = disclosure?.querySelector<HTMLElement>(':scope > [data-disclosure-body]');
  const next = controls.querySelector<HTMLButtonElement>('[data-proof-next]');
  const showAll = controls.querySelector<HTMLButtonElement>('[data-proof-all]');
  const progress = controls.querySelector<HTMLElement>('[data-proof-progress]');
  if (!disclosure || !body || !next || !showAll || !progress) return;
  // Keep a single inline proof intact when MDX emits it without a paragraph.
  if ([...body.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) return;

  const steps: Element[] = [];
  const groups: Array<{ block: Element; first: number }> = [];
  for (const block of body.children) {
    if (block.matches('[hidden], script, style, template, astro-slot')) continue;
    const children = substeps(block);
    if (children?.length) {
      groups.push({ block, first: steps.length });
      steps.push(...children);
    } else {
      steps.push(block);
    }
  }
  if (steps.length < 2) return;

  const total = steps.length;
  let shown = 1;
  const show = (count: number) => {
    shown = count;
    for (const [index, step] of steps.entries()) step.toggleAttribute('data-proof-hidden', index >= shown);
    for (const { block, first } of groups) block.toggleAttribute('data-proof-hidden', first >= shown);
    next.hidden = shown === total;
    showAll.textContent = shown === total ? 'Start over' : 'Show full proof';
    progress.textContent = `Step ${shown} of ${total}`;
  };

  const advance = () => {
    if (shown >= total) return;
    const nextWasFocused = controls.ownerDocument.activeElement === next;
    show(shown + 1);
    const active = next.hidden ? showAll : next;
    if (next.hidden && nextWasFocused) showAll.focus({ preventScroll: true });
    active.scrollIntoView({ block: 'nearest' });
  };

  next.addEventListener('click', advance, { signal });
  disclosure.addEventListener('keydown', (event) => {
    if (!disclosure.open || shown >= total || event.key.toUpperCase() !== nextStepKey ||
        shortcutTarget(event)?.closest('details') !== disclosure) return;
    event.preventDefault();
    advance();
  }, { signal });
  showAll.addEventListener('click', () => {
    if (shown === total) {
      show(1);
      showAll.scrollIntoView({ block: 'nearest' });
    } else {
      show(total);
    }
  }, { signal });

  show(1);
  controls.hidden = false;
  return {
    revealThrough(target) {
      const step = steps.findIndex((element) => element.contains(target));
      const index = step < 0 ? groups.find(({ block }) => block.contains(target))?.first ?? -1 : step;
      if (index >= shown) show(index + 1);
    },
    restore() {
      show(total);
      controls.hidden = true;
    },
  };
}

/** Enhance proof disclosures while leaving their static content readable. */
export function installProofSteps(document: Document) {
  const listeners = new AbortController();
  const proofs = new Map<Element, ProofSteps>();
  for (const controls of document.querySelectorAll<HTMLElement>('[data-proof-controls]')) {
    const proof = initialize(controls, listeners.signal);
    if (proof && controls.parentElement) proofs.set(controls.parentElement, proof);
  }
  return {
    revealThrough(target: Element) {
      for (let node: Element | null = target; node; node = node.parentElement) {
        proofs.get(node)?.revealThrough(target);
      }
    },
    destroy() {
      listeners.abort();
      for (const proof of proofs.values()) proof.restore();
    },
  };
}
