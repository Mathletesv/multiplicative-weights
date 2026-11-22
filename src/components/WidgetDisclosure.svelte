<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    headingId: string;
    title: string;
    children: Snippet;
    onClose?: () => void;
  }

  let { headingId, title, children, onClose }: Props = $props();
</script>

<details ontoggle={(event) => { if (!event.currentTarget.open) onClose?.(); }}>
  <summary id={headingId}>{title}</summary>
  {@render children()}
</details>

<style>
  summary {
    padding: var(--space-4);
    cursor: pointer;
    font-family: var(--font-reading);
    font-size: var(--text-section);
    line-height: var(--leading-heading);
  }

  summary::marker { color: var(--color-accent); }
  summary:hover { background: var(--color-accent-soft); }
  summary:focus-visible { outline-offset: -3px; }
  details[open] > summary { border-bottom: 1px solid var(--color-rule); }
</style>
