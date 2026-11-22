<script lang="ts">
  import { onMount } from 'svelte';
  import { hideRedProbability, hiderEpsilon, hiderRegret, playHiderRound, startHiderGame } from '../../lib/games/hidden-coin';
  import type { Box } from '../../lib/games/hidden-coin';
  import WidgetDisclosure from '../WidgetDisclosure.svelte';
  import HiderRegretChart from './HiderRegretChart.svelte';

  const instanceId = $props.id();
  const headingId = `${instanceId}-title`;
  const boxes = ['red', 'blue'] as const;
  const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 });
  const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  let ready = $state(false);
  let game = $state.raw(startHiderGame(0.5));
  let regretHistory = $state([0]);
  let redProbability = $derived(hideRedProbability(game));
  let probabilities = $derived({ red: redProbability, blue: 1 - redProbability });

  onMount(() => {
    reset();
    ready = true;
  });

  function reset(): void {
    game = startHiderGame(Math.random());
    regretHistory = [0];
  }

  function pick(box: Box): void {
    game = playHiderRound(game, box, Math.random());
    regretHistory.push(hiderRegret(game));
  }
</script>

<section class="hider-game" aria-labelledby={headingId}>
  <WidgetDisclosure {headingId} title="Play against the MWU hider">
    <div class="body">
      <header>
        <strong>Round {game.rounds + 1}</strong>
        <button type="button" onclick={reset} disabled={!ready}>Reset</button>
      </header>

      <dl class="stats">
        <div><dt>Total payoff</dt><dd>{dollars.format(game.totalPayoff)}</dd></div>
        <div><dt>Average payoff</dt><dd>{game.rounds ? dollars.format(game.totalPayoff / game.rounds) : '—'}</dd></div>
        <div><dt>Alice’s expected regret</dt><dd>{dollars.format(regretHistory[game.rounds])}</dd></div>
        <div><dt><span aria-hidden="true">ε</span><span class="visually-hidden">Epsilon</span></dt><dd>{hiderEpsilon}</dd></div>
      </dl>

      <div class="boxes" role="group" aria-label="Pick a box">
        {#each boxes as box (box)}
          <div class="box" class:red={box === 'red'}>
            <div class="chance">
              <span>Alice hides in {box}</span>
              <strong>{percent.format(probabilities[box])}</strong>
            </div>
            <div class="track" aria-hidden="true">
              <span style:inline-size={`${probabilities[box] * 100}%`}></span>
            </div>
            <button class="pick" type="button" onclick={() => pick(box)} disabled={!ready}>Pick {box}</button>
          </div>
        {/each}
      </div>

      <p class="round-result" role="status" class:visually-hidden={!game.lastRound}>
        {#if game.lastRound}
          <span>Alice hid in {game.lastRound.hidden}</span>
          <span>You picked {game.lastRound.picked}</span>
          <strong>{dollars.format(game.lastRound.payoff)} earned</strong>
        {/if}
      </p>

      {#if game.rounds}
        <HiderRegretChart history={regretHistory} formatDollars={dollars.format} />
      {/if}
    </div>
  </WidgetDisclosure>
</section>

<style>
  .hider-game {
    margin-block: var(--space-6);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
    font-family: var(--font-interface);
    font-size: var(--text-ui);
    line-height: var(--leading-ui);
  }

  .body { display: grid; gap: var(--space-4); padding: var(--space-4); }

  header, .chance, .round-result {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
  }

  header { align-items: center; }

  .stats, .boxes { display: grid; gap: var(--space-3); }
  .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; }
  .stats > div { border-block-start: 1px solid var(--color-rule); padding-block-start: var(--space-2); }
  dt { font-size: var(--text-sm); color: var(--color-muted); }
  dd { margin: 0; font-weight: 600; }
  dd, .chance strong, .round-result strong { font-variant-numeric: tabular-nums; }

  .boxes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .box {
    --box-color: var(--color-box-blue);
    display: grid;
    gap: var(--space-2);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    padding: var(--space-3);
    background: var(--color-paper);
  }
  .box.red { --box-color: var(--color-box-red); }
  .chance {
    color: var(--box-color);
    font-size: var(--text-sm);
  }
  .track {
    block-size: var(--space-1);
    overflow: hidden;
    border-radius: var(--radius-panel);
    background: var(--color-rule);
  }
  .track span {
    display: block;
    block-size: 100%;
    background: var(--box-color);
    transition: inline-size var(--motion-duration);
  }

  button {
    min-block-size: var(--space-10);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius-panel);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    color: var(--color-ink);
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled { cursor: default; color: var(--color-muted); }
  button:not(:disabled):hover { border-color: var(--color-accent); background: var(--color-accent-soft); }
  button.pick:not(:disabled) { border-color: var(--box-color); color: var(--box-color); }
  button.pick:not(:disabled):hover { background: var(--box-color); color: var(--color-surface); }

  .round-result:not(.visually-hidden) {
    border-radius: var(--radius-panel);
    padding: var(--space-3);
    background: var(--color-accent-soft);
    color: var(--color-accent-hover);
  }

  @media (max-width: 34rem) {
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
