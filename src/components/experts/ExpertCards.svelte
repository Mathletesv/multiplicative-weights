<script lang="ts">
  import { roundCount } from '../../lib/experts/game';
  import type { ExpertRoundView } from '../../lib/experts/game';

  interface Props { experts: readonly ExpertRoundView[] }
  let { experts }: Props = $props();
  let trueVotes = $derived(experts.filter(({ vote }) => vote).length);
</script>

<div class="panel">
  <div class="panel-heading">
    <span>Expert votes</span>
    <span>{trueVotes} True · {experts.length - trueVotes} False</span>
  </div>
  <ul class="experts" aria-label="Expert votes and records">
    {#each experts as expert (expert.id)}
      <li class="expert">
        <p class="name">Expert {expert.id}</p>
        <span class="vote" class:true-vote={expert.vote}>{expert.vote ? 'True' : 'False'}</span>
        <p class="record">{expert.correct}/{expert.record.length} correct</p>
        <div class="history" aria-hidden="true">
          {#each { length: roundCount } as _, index (index)}
            {@const correct = expert.record[index]}
            <span class:correct={correct === true} class:miss={correct === false}>
              {correct === undefined ? '·' : correct ? '✓' : '×'}
            </span>
          {/each}
        </div>
        {#if expert.record.length}
          <span class="visually-hidden">
            Record by round. {expert.record.map((correct) => correct ? 'Correct' : 'Miss').join(', ')}.
          </span>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .panel { min-inline-size: 0; display: grid; gap: var(--space-3); align-content: start; }
  .panel-heading {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2);
    color: var(--color-muted);
    font-size: var(--text-sm);
  }
  .panel-heading > :first-child { color: var(--color-ink); font-weight: 600; }
  .panel .experts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .expert {
    container: expert-card / inline-size;
    display: grid;
    justify-items: start;
    gap: var(--space-2);
    padding: var(--space-3);
    min-inline-size: 0;
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
  }
  .expert p { margin: 0; }
  .name { font-weight: 600; }
  .vote {
    display: inline-block;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-panel);
    background: var(--color-paper);
    font-weight: 600;
    font-size: var(--text-sm);
  }
  .true-vote { color: var(--color-accent-hover); background: var(--color-accent-soft); }
  .record { font-size: var(--text-sm); color: var(--color-muted); font-variant-numeric: tabular-nums; }
  .history {
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    width: 100%;
    text-align: center;
    font-size: var(--text-xs);
    color: var(--color-muted);
    line-height: var(--leading-ui);
    font-variant-numeric: tabular-nums;
  }
  .history .correct { color: var(--color-accent-hover); }
  .history .miss { color: var(--color-ink); }
  @container expert-card (max-width: 7rem) {
    .history { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  }
  @container expert-game (min-width: 38rem) {
    .panel .experts { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  }
</style>
