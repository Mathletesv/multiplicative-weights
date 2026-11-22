<script lang="ts">
  import { scoreGuesses } from '../../lib/experts/game';
  import type { Board } from '../../lib/experts/game';

  let { board, guesses }: { board: Board; guesses: readonly boolean[] } = $props();
  let score = $derived(scoreGuesses(board, guesses));
</script>

<div class="scores" aria-live="polite" aria-atomic="true">
  <span>After {guesses.length} {guesses.length === 1 ? 'round' : 'rounds'}</span>
  <dl>
    <div><dt>Your mistakes</dt><dd>{score.playerMistakes}</dd></div>
    <div><dt>Best fixed expert’s mistakes</dt><dd>{score.bestMistakes}</dd></div>
    <div><dt>Realized regret</dt><dd>{score.regret}</dd></div>
  </dl>
</div>

<style>
  .scores { display: grid; gap: var(--space-2); font-family: var(--font-interface); }
  .scores > span, dt { font-size: var(--text-sm); color: var(--color-muted); }
  dl { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); margin: 0; }
  dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
  dl > div:last-child dd { color: var(--color-accent); }
</style>
