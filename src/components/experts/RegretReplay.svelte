<script lang="ts">
  import { onMount } from 'svelte';
  import { viewRound } from '../../lib/experts/game';
  import { nextStepKey } from '../../scripts/keyboard-shortcuts';
  import { openingGame } from './opening-game';
  import ExpertCards from './ExpertCards.svelte';
  import ExpertGame from './ExpertGame.svelte';
  import RegretScore from './RegretScore.svelte';

  let replaying = $state(false);
  let index = $state(0);
  onMount(() => openingGame.subscribe(recording => {
    if (!recording) {
      replaying = false;
      index = 0;
    }
  }));
</script>

<ExpertGame preset="mixed-accuracy" title="Replay with realized regret" collapsible showRegret>
  {#snippet layout(game)}
    <div hidden={replaying && !!$openingGame}>
      {@render game()}
    </div>
    {#if $openingGame}
      {#if replaying}
        {@const round = viewRound($openingGame.board, $openingGame.progress, index)}
        <div class="body">
          <h3>Replay round {round.number} of {$openingGame.progress.guesses.length}</h3>
          <p>Verdict: {round.verdict ? 'True' : 'False'} · You chose {round.guess ? 'True' : 'False'}</p>
          <RegretScore board={$openingGame.board} guesses={$openingGame.progress.guesses.slice(0, round.number)} />
          <div class="controls">
            <button type="button" disabled={index === 0} onclick={() => index--}>Previous round</button>
            <button type="button" data-widget-shortcut aria-keyshortcuts={nextStepKey}
              disabled={round.number === $openingGame.progress.guesses.length} onclick={() => index++}>
              Next round <kbd aria-hidden="true">{nextStepKey}</kbd>
            </button>
          </div>
          <ExpertCards experts={round.experts} />
        </div>
      {/if}
      <div class="switch-view">
        <button type="button" onclick={() => replaying = !replaying}>
          {replaying ? 'Return to your game' : 'Replay opening game'}
        </button>
      </div>
    {/if}
  {/snippet}
</ExpertGame>

<style>
  .switch-view { padding: var(--space-2) var(--space-4) var(--space-4); }
  .body { display: grid; gap: var(--space-3); padding: var(--space-4); font: var(--text-ui) / var(--leading-ui) var(--font-interface); }
  .body > :is(h3,p) { margin: 0; }
  .controls { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  button {
    justify-self: start;
    min-block-size: var(--space-10);
    padding: var(--space-2) var(--space-3);
    color: var(--color-ink);
    background: var(--color-surface);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius-panel);
    cursor: pointer;
  }
  button:disabled { color: var(--color-muted); cursor: default; }
  button:not(:disabled):hover { background: var(--color-accent-soft); }
</style>
