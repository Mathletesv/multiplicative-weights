<script lang="ts">
  import { onMount } from 'svelte';
  import { freshSeed } from '../../lib/experts/random';
  import { createWeightRun, maxDecisions, maxEpsilon, minDecisions, minEpsilon } from '../../lib/experts/weights';
  import { nextStepKey, widgetShortcuts } from '../../scripts/keyboard-shortcuts';
  import WeightCards from './WeightCards.svelte';
  import WidgetDisclosure from '../WidgetDisclosure.svelte';

  const instanceId = $props.id();
  const headingId = `${instanceId}-title`;
  const lengthId = `${instanceId}-length`;
  const epsilonId = `${instanceId}-epsilon`;
  const autoplayInterval = 2000;

  let ready = $state(false);
  let seed = $state(0);
  let decisions = $state(30);
  let epsilon = $state<number>();
  let completed = $state(0);
  let playing = $state(false);
  let run = $derived(createWeightRun(decisions, seed, epsilon));
  let frame = $derived(run.frames[completed]);
  let finished = $derived(completed >= decisions);

  onMount(() => {
    reset();
    ready = true;
  });

  function advance(): void {
    if (completed >= decisions) return;
    completed++;
    if (completed === decisions) playing = false;
  }

  function pause(): void {
    playing = false;
  }

  function rewind(): void {
    pause();
    completed = 0;
  }

  function reset(): void {
    rewind();
    seed = freshSeed(seed);
  }

  function changeDecisionCount(count: number): void {
    if (count === decisions) return;
    rewind();
    decisions = count;
  }

  function changeEpsilon(rate: number): void {
    if (rate === run.learningRate) return;
    pause();
    epsilon = rate;
  }

  $effect(() => {
    if (!playing) return;
    const timer = window.setInterval(advance, autoplayInterval);
    return () => window.clearInterval(timer);
  });
</script>

<section class="weight-simulation" aria-labelledby={headingId} tabindex="-1" data-widget-shortcuts {@attach widgetShortcuts}>
  <WidgetDisclosure {headingId} title="Weight simulation" onClose={pause}>
    <header class="run-summary">
      <div class="progress">
        <p role="status">Decision {completed} of {decisions}</p>
        <progress aria-label="Decisions completed" max={decisions} value={completed}></progress>
      </div>
      <dl class="algorithm-loss">
        <dt>Algorithm cumulative loss</dt>
        <dd>{frame.cumulativeLoss.toFixed(3)}</dd>
      </dl>
    </header>

    <div class="simulation-body">
      <div class="toolbar">
        <div class="parameters">
          <div class="range-control">
            <label for={lengthId}>Decisions</label>
            <span class="range-value">{decisions}</span>
            <input
              id={lengthId}
              type="range"
              min={minDecisions}
              max={maxDecisions}
              step="1"
              value={decisions}
              disabled={!ready}
              oninput={(event) => changeDecisionCount(event.currentTarget.valueAsNumber)}
            />
          </div>
          <div class="range-control">
            <label for={epsilonId}>
              <span aria-hidden="true">ε</span>
              <span class="visually-hidden">Epsilon</span>
            </label>
            <span class="range-value">{run.learningRate.toFixed(3)}</span>
            <input
              id={epsilonId}
              type="range"
              min={minEpsilon}
              max={maxEpsilon}
              step="0.001"
              value={Number(run.learningRate.toFixed(3))}
              disabled={!ready}
              oninput={(event) => changeEpsilon(event.currentTarget.valueAsNumber)}
            />
          </div>
        </div>
        <div class="actions" role="group" aria-label="Simulation controls">
          <button class="primary" type="button" data-widget-shortcut aria-keyshortcuts={nextStepKey}
            onclick={advance} disabled={!ready || finished || playing}>
            Next decision <kbd aria-hidden="true">{nextStepKey}</kbd>
          </button>
          <button type="button" onclick={() => { playing = !playing; }} disabled={!ready || finished}>
            {playing ? 'Pause' : 'Autoplay'}
          </button>
          <button type="button" onclick={reset} disabled={!ready}>Reset</button>
        </div>
      </div>

      <WeightCards experts={frame.experts} selected={frame.selected} />
    </div>
  </WidgetDisclosure>
</section>

<style>
  .weight-simulation {
    margin-block: var(--space-6);
    overflow: hidden;
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-interface);
    font-size: var(--text-ui);
    line-height: var(--leading-ui);
  }

  .run-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3) var(--space-6);
    border-bottom: 1px solid var(--color-rule);
    padding: var(--space-4);
  }

  .algorithm-loss {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    color: var(--color-muted);
    font-size: var(--text-sm);
  }

  .algorithm-loss dd { margin: 0; color: var(--color-ink); font-weight: 600; }
  .algorithm-loss dd, .range-value, .progress p { font-variant-numeric: tabular-nums; }

  .progress {
    display: grid;
    flex: 0 1 14rem;
    gap: var(--space-1);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  progress, input { inline-size: 100%; accent-color: var(--color-accent); }
  progress { block-size: var(--space-2); }
  input { margin: 0; }

  .simulation-body {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--color-paper);
  }

  .toolbar, .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-2);
  }

  .toolbar { justify-content: space-between; gap: var(--space-3) var(--space-5); }

  .parameters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    flex: 1 1 16rem;
    gap: var(--space-4);
    min-inline-size: 0;
    max-inline-size: 28rem;
  }

  .range-control {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-1) var(--space-3);
    min-inline-size: 0;
    font-size: var(--text-sm);
  }

  .range-control input { grid-column: 1 / -1; }
  .range-value { color: var(--color-muted); }

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

  button:not(:disabled):hover { border-color: var(--color-accent); background: var(--color-accent-soft); }
  button:disabled { color: var(--color-muted); cursor: default; }
  button.primary:not(:disabled) { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-surface); }
  button.primary:not(:disabled):hover { background: var(--color-accent-hover); }
</style>
