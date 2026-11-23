<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Snippet } from 'svelte';
  import {
    advanceRound, createBoard, getRoundIndex, guessRound, playerRecord,
    roundCount, scoreBoard, startGame, viewRound,
  } from '../../lib/experts/game';
  import type { Conjecture, GamePreset } from '../../lib/experts/game';
  import { freshSeed } from '../../lib/experts/random';
  import { nextStepKey, widgetShortcuts } from '../../scripts/keyboard-shortcuts';
  import { openingGame } from './opening-game';
  import RegretScore from './RegretScore.svelte';
  import ExpertCards from './ExpertCards.svelte';
  import GameResults from './GameResults.svelte';
  import WidgetDisclosure from '../WidgetDisclosure.svelte';

  interface Props {
    preset: GamePreset;
    title?: string;
    layout?: Snippet<[Snippet]>;
    conjectures?: readonly Conjecture[];
    collapsible?: boolean;
    recordForReplay?: boolean;
    showRegret?: boolean;
  }

  let { preset, title, layout, conjectures, collapsible = false, recordForReplay = false, showRegret = false }: Props = $props();
  const instanceId = $props.id();
  const headingId = `${instanceId}-title`;
  const trueKey = 'T';
  const falseKey = 'F';
  const staticSeeds: Record<GamePreset, number> = { 'reliable-experts': 3, 'mixed-accuracy': 8, 'coin-flip-experts': 11 };
  const titles: Record<GamePreset, string> = {
    'reliable-experts': 'Find the Reliable Experts',
    'mixed-accuracy': 'Trust the Streak?',
    'coin-flip-experts': 'Secret Bad Loss',
  };

  let gameTitle = $derived(title ?? (showRegret ? 'Play with realized regret' : titles[preset]));
  let ready = $state(false);
  let progress = $state.raw(startGame());
  let seed = $state<number>();
  let reviewIndex = $state(0);
  let roundTitle: HTMLHeadingElement | undefined = $state();
  let resultsTitle: HTMLHeadingElement | undefined = $state();
  let nextButton: HTMLButtonElement | undefined = $state();

  let board = $derived(createBoard(preset, seed ?? staticSeeds[preset], conjectures));
  let finished = $derived(progress.phase === 'finished');
  let round = $derived(viewRound(board, progress, finished ? reviewIndex : getRoundIndex(progress)));
  let record = $derived(playerRecord(board, progress));
  let correctCount = $derived(record.filter(Boolean).length);
  let score = $derived(finished ? scoreBoard(board, progress) : undefined);

  onMount(() => {
    reseed();
    ready = true;
  });

  function reseed(): void {
    seed = freshSeed(seed ?? staticSeeds[preset]);
  }

  async function submit(guess: boolean): Promise<void> {
    if (!ready || progress.phase !== 'guess') return;
    progress = guessRound(progress, guess);
    if (recordForReplay) openingGame.set({ board, progress });
    await tick();
    nextButton?.focus();
  }

  async function next(): Promise<void> {
    if (progress.phase !== 'reveal') return;
    progress = advanceRound(progress);
    await tick();
    (finished ? resultsTitle : roundTitle)?.focus();
  }

  async function restart(): Promise<void> {
    reseed();
    progress = startGame();
    if (recordForReplay) openingGame.set(undefined);
    reviewIndex = 0;
    await tick();
    roundTitle?.focus();
  }

  const verdictText = (value: boolean): string => value ? 'True' : 'False';
</script>

{#snippet gameContents()}
  <header class="game-header" class:progress-only={collapsible}>
    {#if !collapsible}<h2 class="game-title" id={headingId}>{gameTitle}</h2>{/if}
    <div class="progress" role="group" aria-label="Game progress">
      <div class="progress-labels">
        <span>{finished ? `${roundCount} rounds complete` : `Round ${round.number} of ${roundCount}`}</span>
        <span>{correctCount} correct · {record.length - correctCount} {record.length - correctCount === 1 ? 'mistake' : 'mistakes'}</span>
      </div>
      <div class="progress-marks" aria-hidden="true">
        {#each { length: roundCount } as _, index (index)}
          <span class:answered={index < record.length} class:current={!finished && index === round.number - 1}></span>
        {/each}
      </div>
    </div>
  </header>

  {#if score}
    <div class="results-panel">
      <div class="results-header">
        <h3 class="round-title" bind:this={resultsTitle} tabindex="-1">Game results</h3>
        <button class="primary" type="button" onclick={restart}>New game</button>
      </div>
      <GameResults {score} {preset} selected={reviewIndex} onReview={(index) => { reviewIndex = index; }} />
    </div>
  {/if}

  <div class="board">
    <div class="conjecture">
      <h3 class="round-title" bind:this={roundTitle} tabindex="-1">Conjecture {round.number}</h3>
      {#if round.prompt}<p class="prompt">{round.prompt}</p>{/if}
    </div>

    <div class="expert-votes"><ExpertCards experts={round.experts} /></div>

    <div class="actions">
      {#if showRegret}
        <RegretScore {board} guesses={progress.guesses.slice(0, round.number)} />
      {/if}
      {#if !finished && progress.phase === 'guess'}
        <div class="choice-row" role="group" aria-label="Your prediction">
          <button type="button" data-widget-shortcut aria-keyshortcuts={trueKey}
            onclick={() => submit(true)} disabled={!ready}>
            True <kbd aria-hidden="true">{trueKey}</kbd>
          </button>
          <button type="button" data-widget-shortcut aria-keyshortcuts={falseKey}
            onclick={() => submit(false)} disabled={!ready}>
            False <kbd aria-hidden="true">{falseKey}</kbd>
          </button>
        </div>
      {/if}
      <p class="outcome" role="status" class:revealed={round.verdict !== undefined} class:visually-hidden={round.verdict === undefined}>
        {#if round.verdict !== undefined && round.guess !== undefined}
          <strong>{round.guess === round.verdict ? 'Correct' : 'Incorrect'}</strong>
          <span>Verdict: {verdictText(round.verdict)} · You chose {verdictText(round.guess)}</span>
        {/if}
      </p>
      {#if !finished && progress.phase === 'reveal'}
        <button class="primary" type="button" data-widget-shortcut aria-keyshortcuts={nextStepKey}
          bind:this={nextButton} onclick={next}>
          {round.number === roundCount ? 'See results' : 'Next round'}
          <kbd aria-hidden="true">{nextStepKey}</kbd>
        </button>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet panelContents()}
  {#if layout}
    {@render layout(gameContents)}
  {:else}
    {@render gameContents()}
  {/if}
{/snippet}

<section class="expert-game" aria-labelledby={headingId} tabindex="-1" data-widget-shortcuts {@attach widgetShortcuts}>
  {#if collapsible}
    <WidgetDisclosure {headingId} title={gameTitle}>
      {@render panelContents()}
    </WidgetDisclosure>
  {:else}
    {@render panelContents()}
  {/if}
</section>

<style>
  .expert-game {
    container: expert-game / inline-size;
    margin-block: var(--space-6);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-interface);
    font-size: var(--text-ui);
    line-height: var(--leading-ui);
  }
  .game-header {
    display: grid;
    gap: var(--space-3);
    align-items: end;
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-rule);
  }
  .expert-game .game-title {
    margin: 0;
    font-size: var(--text-section);
    line-height: var(--leading-heading);
  }
  .progress { display: grid; gap: var(--space-2); min-inline-size: 0; }
  .progress-labels {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    color: var(--color-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .progress-labels > :first-child { font-weight: 600; color: var(--color-ink); }
  .progress-marks { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: var(--space-1); }
  .progress-marks span { block-size: var(--space-1); border-radius: var(--radius-panel); background: var(--color-rule); }
  .progress-marks .answered { background: var(--color-accent); }
  .progress-marks .current { outline: 1px solid var(--color-accent); }
  .board {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--color-paper);
    border-end-start-radius: var(--radius-panel);
    border-end-end-radius: var(--radius-panel);
  }
  .conjecture { display: grid; gap: var(--space-2); align-content: start; }
  .expert-game .round-title { margin: 0; font-size: var(--text-body); }
  .prompt { margin: 0; font-family: var(--font-reading); font-size: var(--text-body); }
  .actions { display: grid; gap: var(--space-3); align-content: start; }
  .choice-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
  button {
    min-block-size: var(--space-12);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
    color: var(--color-ink);
    font-weight: 600;
    cursor: pointer;
  }
  button:not(:disabled):hover { background: var(--color-accent-soft); border-color: var(--color-accent); }
  button:disabled { color: var(--color-muted); cursor: default; }
  .primary { background: var(--color-accent); color: var(--color-surface); border-color: var(--color-accent); }
  button.primary:hover { background: var(--color-accent-hover); color: var(--color-surface); }
  .outcome { margin: 0; }
  .outcome.revealed {
    display: grid;
    gap: var(--space-1);
    padding-inline-start: var(--space-3);
    border-inline-start: 2px solid var(--color-accent);
  }
  .outcome span { color: var(--color-muted); font-size: var(--text-sm); }
  .results-panel { display: grid; gap: var(--space-4); padding: var(--space-4); border-bottom: 1px solid var(--color-rule); }
  .results-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--space-3); }

  @container expert-game (min-width: 38rem) {
    .game-header:not(.progress-only) { grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.65fr); }
    .game-header, .board, .results-panel { padding: var(--space-5); }
  }

  @container expert-game (min-width: 51rem) {
    .board {
      grid-template-columns: minmax(12rem, 0.7fr) minmax(0, 2fr);
      grid-template-areas: 'conjecture experts' 'actions experts';
      grid-template-rows: auto 1fr;
      align-items: start;
      column-gap: var(--space-6);
    }
    .conjecture { grid-area: conjecture; }
    .expert-votes { grid-area: experts; }
    .actions { grid-area: actions; }
  }
</style>
