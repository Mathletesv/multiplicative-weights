<script lang="ts">
  import { roundCount } from '../../lib/experts/game';
  import type { BoardScore, GamePreset } from '../../lib/experts/game';

  interface Props {
    score: BoardScore;
    preset: GamePreset;
    selected: number;
    onReview: (index: number) => void;
  }
  let { score, preset, selected, onReview }: Props = $props();
  let sampledAccuracy = $derived(preset === 'mixed-accuracy');
  const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 });
</script>

<div class="results">
  <dl class="scoreboard">
    <div>
      <dt>Your mistakes</dt>
      <dd>{score.playerMistakes}<span> / {roundCount}</span></dd>
    </div>
    <div>
      <dt>Best fixed expert</dt>
      <dd>{score.bestMistakes}<span> / {roundCount} mistakes</span></dd>
      <dd class="experts">{score.bestExperts.length === 1 ? 'Expert' : 'Experts'} {score.bestExperts.join(', ')}</dd>
    </div>
  </dl>

  <table>
    <caption class="visually-hidden">Expert scores after ten rounds</caption>
    <thead>
      <tr>
        <th scope="col">Expert</th>
        <th scope="col">Correct</th>
        <th scope="col">{sampledAccuracy ? 'Sampled accuracy' : 'Voting rule'}</th>
      </tr>
    </thead>
    <tbody>
      {#each score.experts as expert (expert.id)}
        <tr>
          <th scope="row">Expert {expert.id}</th>
          <td>{expert.correct}/{roundCount}</td>
          <td>{sampledAccuracy
            ? percent.format(expert.accuracy)
            : expert.accuracy === 1 ? 'Always correct' : 'Coin flip'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<div class="review">
  <span>Review rounds</span>
  <div class="rounds" role="group" aria-label="Review rounds">
    {#each score.record as correct, index (index)}
      <button
        type="button"
        aria-label={`Review round ${index + 1}, ${correct ? 'correct' : 'miss'}`}
        aria-pressed={index === selected}
        onclick={() => onReview(index)}
      >{index + 1}</button>
    {/each}
  </div>
</div>

<style>
  .results { display: grid; gap: var(--space-4); }
  .scoreboard {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .scoreboard > div {
    padding: var(--space-3);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
  }
  dt, .experts { font-size: var(--text-sm); color: var(--color-muted); }
  dd { margin: 0; font-size: var(--text-section); font-variant-numeric: tabular-nums; }
  dd span { font-size: var(--text-sm); color: var(--color-muted); }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  th, td { padding: var(--space-2) var(--space-1); text-align: start; border-bottom: 1px solid var(--color-rule); }
  th { font-weight: 600; }
  td { font-variant-numeric: tabular-nums; }
  .review { display: grid; gap: var(--space-2); }
  .review > span { font-weight: 600; }
  .rounds { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--space-2); }
  button {
    min-block-size: var(--space-10);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
    color: var(--color-ink);
    cursor: pointer;
  }
  button:hover, button[aria-pressed="true"] {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-accent-hover);
  }
  button[aria-pressed="true"] { font-weight: 700; }
  @container expert-game (min-width: 38rem) {
    .results { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
    .rounds { grid-template-columns: repeat(10, minmax(0, 1fr)); }
  }
</style>
