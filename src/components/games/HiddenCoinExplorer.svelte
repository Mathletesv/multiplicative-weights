<script lang="ts">
  import { onMount } from 'svelte';
  import { hiddenCoinExpectation } from '../../lib/games/hidden-coin';
  import WidgetDisclosure from '../WidgetDisclosure.svelte';

  const instanceId = $props.id();
  const headingId = `${instanceId}-title`;
  const aliceId = `${instanceId}-alice`;
  const bobId = `${instanceId}-bob`;
  const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 });
  const dollars = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 3,
  });

  let ready = $state(false);
  let hideRed = $state<number | undefined>(0.5);
  let pickRed = $state<number | undefined>(0.5);
  const isProbability = (value: number | undefined): value is number =>
    value !== undefined && value >= 0 && value <= 1;

  let result = $derived(isProbability(hideRed) && isProbability(pickRed)
    ? hiddenCoinExpectation(hideRed, pickRed)
    : undefined);

  onMount(() => { ready = true; });
</script>

<section class="coin-explorer" aria-labelledby={headingId}>
  <WidgetDisclosure {headingId} title="Hidden Coin payoff calculator">
    <div class="body">
      <div class="strategies">
        <div class="strategy">
          <label for={aliceId}>Alice hides in red</label>
          <input id={aliceId} type="number" min="0" max="1" step="any" bind:value={hideRed}
            aria-invalid={hideRed !== undefined && !isProbability(hideRed)} disabled={!ready} />
        </div>
        <div class="strategy">
          <label for={bobId}>Bob picks red</label>
          <input id={bobId} type="number" min="0" max="1" step="any" bind:value={pickRed}
            aria-invalid={pickRed !== undefined && !isProbability(pickRed)} disabled={!ready} />
        </div>
      </div>

      <div class="payoff" role="status">
        <span>Bob’s expected payoff</span>
        <strong>{result ? dollars.format(result.expectedPayoff) : '—'}</strong>
      </div>

      <dl class="outcomes">
        <div><dt>Red match</dt><dd>{result ? percent.format(result.redMatch) : '—'}</dd></div>
        <div><dt>Blue match</dt><dd>{result ? percent.format(result.blueMatch) : '—'}</dd></div>
        <div><dt>Miss</dt><dd>{result ? percent.format(result.miss) : '—'}</dd></div>
      </dl>
    </div>
  </WidgetDisclosure>
</section>

<style>
  .coin-explorer {
    margin-block: var(--space-6);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
    font-family: var(--font-interface);
    font-size: var(--text-ui);
    line-height: var(--leading-ui);
  }

  .body { display: grid; gap: var(--space-4); padding: var(--space-4); }

  .strategies, .outcomes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .strategy { display: grid; gap: var(--space-2); align-content: end; }
  .strategy label { font-weight: 600; }

  input {
    inline-size: 100%;
    min-block-size: var(--space-10);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius-panel);
    padding: var(--space-2);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  input[aria-invalid="true"] { border-color: var(--color-box-red); }

  .payoff {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    border-radius: var(--radius-panel);
    padding: var(--space-3);
    background: var(--color-accent-soft);
    color: var(--color-accent-hover);
  }

  .payoff strong { font-size: var(--text-section); line-height: var(--leading-heading); }
  .outcomes { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
  .outcomes > div { border-top: 1px solid var(--color-rule); padding-block-start: var(--space-2); }
  dt { color: var(--color-muted); font-size: var(--text-sm); }
  dd { margin: 0; font-weight: 600; }
  input, .payoff strong, dd { font-variant-numeric: tabular-nums; }
</style>
