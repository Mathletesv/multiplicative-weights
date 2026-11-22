export const nextStepKey = 'N';

export function shortcutTarget(event: KeyboardEvent): Element | undefined {
  if (event.defaultPrevented || event.repeat || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.key.length !== 1) return;
  const target = event.target;
  if (target instanceof Element &&
      !target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])')) return target;
}

/** Activate the enabled shortcut button in the focused widget. */
export function widgetShortcuts(widget: HTMLElement): () => void {
  function onKeydown(event: KeyboardEvent): void {
    if (!shortcutTarget(event) ||
        widget.ownerDocument.activeElement?.closest('[data-widget-shortcuts]') !== widget) return;
    const key = event.key.toUpperCase();
    const button = [...widget.querySelectorAll<HTMLButtonElement>('button[data-widget-shortcut]:enabled')].find(
      (button) => button.getAttribute('aria-keyshortcuts') === key &&
        button.closest('[data-widget-shortcuts]') === widget &&
        !button.closest('[hidden], details:not([open])'),
    );
    if (!button) return;
    event.preventDefault();
    button.click();
  }

  widget.addEventListener('keydown', onKeydown);
  return () => widget.removeEventListener('keydown', onKeydown);
}
