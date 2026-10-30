<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    width?: number;
    height?: number;
    children: Snippet;
  }

  let { label, width = 640, height = 400, children }: Props = $props();
</script>

<svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
  {@render children()}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
