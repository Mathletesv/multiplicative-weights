<script lang="ts">
  import type { ExpertId } from '../../lib/experts/game';
  import type { ExpertWeight } from '../../lib/experts/weights';

  interface Props {
    experts: readonly ExpertWeight[];
    selected?: ExpertId;
  }
  let { experts, selected }: Props = $props();
</script>

<div class="weight-cards">
  <ul class="experts" aria-label="Expert losses and weights">
    {#each experts as expert (expert.id)}
      <li class:selected={selected === expert.id}>
        <div class="expert-heading">
          <strong>Expert {expert.id}</strong>
          {#if selected === expert.id}<span>Selected</span>{/if}
        </div>
        <dl class="parameters" aria-label="Gaussian loss parameters">
          <div>
            <dt><span aria-hidden="true">μ</span><span class="visually-hidden">Mean parameter</span></dt>
            <dd>{expert.distribution.mean.toFixed(2)}</dd>
          </div>
          <div>
            <dt><span aria-hidden="true">σ</span><span class="visually-hidden">Standard deviation parameter</span></dt>
            <dd>{expert.distribution.standardDeviation.toFixed(2)}</dd>
          </div>
        </dl>
        <dl>
          <div class="metric loss">
            <dt>Loss</dt>
            <dd>
              {expert.loss?.toFixed(3) ?? '—'}
              <span class="track" aria-hidden="true"><span style:inline-size={`${(expert.loss ?? 0) * 100}%`}></span></span>
            </dd>
          </div>
          <div class="metric">
            <dt>Weight</dt>
            <dd>
              {expert.weight > 0 && expert.weight < 0.001 ? '<0.001' : expert.weight.toFixed(3)}
              <span class="track" aria-hidden="true"><span style:inline-size={`${expert.weight * 100}%`}></span></span>
            </dd>
          </div>
          <div class="cumulative">
            <dt>Cumulative loss</dt>
            <dd>{expert.cumulativeLoss.toFixed(3)}</dd>
          </div>
        </dl>
      </li>
    {/each}
  </ul>
</div>

<style>
  .weight-cards { container-type: inline-size; min-inline-size: 0; }

  .weight-cards .experts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    align-content: start;
    gap: var(--space-3);
    min-inline-size: 0;
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    padding: var(--space-3);
    background: var(--color-surface);
  }

  li.selected {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .expert-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0 var(--space-2);
  }

  .expert-heading span {
    color: var(--color-accent);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  dl {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-sm);
  }

  .parameters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
  }

  .parameters > div { display: flex; gap: var(--space-1); }

  .metric {
    position: relative;
    display: flex;
    justify-content: space-between;
    gap: var(--space-1);
    padding-block-end: var(--space-2);
  }

  dt { color: var(--color-muted); }
  dd { margin: 0; text-align: end; font-variant-numeric: tabular-nums; }

  .cumulative {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-1);
    border-block-start: 1px solid var(--color-rule);
    padding-block-start: var(--space-2);
  }

  .track {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    block-size: var(--space-1);
    overflow: hidden;
    border-radius: var(--radius-panel);
    background: var(--color-rule);
  }

  .track span {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: var(--color-accent);
    transition: inline-size var(--motion-duration);
  }

  .loss .track span { background: var(--color-muted); }

  @container (min-width: 38rem) {
    .weight-cards .experts { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  }
</style>
