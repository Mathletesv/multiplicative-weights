<script lang="ts">
  import { scaleLinear } from 'd3-scale';
  import { line } from 'd3-shape';

  interface Props {
    history: readonly number[];
    formatDollars: (value: number) => string;
  }

  let { history, formatDollars }: Props = $props();
  let lastRound = $derived(history.length - 1);
  let plot = $derived.by(() => {
    const peak = history.reduce((maximum, regret) => Math.max(maximum, regret), 1);
    const x = scaleLinear([0, lastRound], [0, 100]);
    const y = scaleLinear([0, peak], [100, 0]).nice(2);
    const top = y.domain()[1];
    return {
      path: line<number>().x((_, round) => x(round)).y(y)(history),
      labels: [top, top / 2, 0],
    };
  });
</script>

<figure class="chart">
  <figcaption>Cumulative expected regret</figcaption>
  <div class="scale" aria-hidden="true">
    {#each plot.labels as label (label)}
      <span>{formatDollars(label)}</span>
    {/each}
  </div>
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Alice’s cumulative expected regret through round ${lastRound}`}>
    <path class="grid" d="M0 0H100 M0 50H100 M0 100H100" vector-effect="non-scaling-stroke" />
    <path class="trend" d={plot.path ?? ''} vector-effect="non-scaling-stroke" />
  </svg>
  <div class="rounds" aria-hidden="true">
    <span>Round 0</span>
    <span>Round {lastRound}</span>
  </div>
</figure>

<style>
  .chart {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-2) var(--space-3);
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    background: var(--color-paper);
  }

  figcaption { grid-column: 1 / -1; font-weight: 600; }
  .scale, .rounds {
    display: flex;
    justify-content: space-between;
    color: var(--color-muted);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }
  .scale { flex-direction: column; text-align: end; line-height: 1; }
  .rounds { grid-column: 2; }
  svg { display: block; inline-size: 100%; block-size: var(--space-24); overflow: visible; }
  path { fill: none; }
  .grid { stroke: var(--color-rule); }
  .trend { stroke: var(--color-accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
