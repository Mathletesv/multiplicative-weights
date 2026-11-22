import { sampleTruncatedGaussian, seededRandom, shuffle } from './random.ts';

export const expertIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
export const roundCount = 10;

export type ExpertId = (typeof expertIds)[number];
export type GamePreset = 'reliable-experts' | 'mixed-accuracy' | 'coin-flip-experts';

/** An optional owner-authored prompt and its fixed verdict. */
export interface Conjecture {
  prompt: string;
  verdict: boolean;
}

export interface Expert {
  id: ExpertId;
  accuracy: number;
}

interface Round {
  prompt?: string;
  verdict: boolean;
  votes: Record<ExpertId, boolean>;
}

export interface Board {
  experts: readonly Expert[];
  rounds: readonly Round[];
}

export interface GameProgress {
  phase: 'guess' | 'reveal' | 'finished';
  guesses: readonly boolean[];
}

export interface ExpertRoundView {
  id: ExpertId;
  vote: boolean;
  record: readonly boolean[];
  correct: number;
}

export interface RoundView {
  number: number;
  prompt?: string;
  verdict?: boolean;
  guess?: boolean;
  experts: readonly ExpertRoundView[];
}

export function createBoard(preset: GamePreset, seed: number, conjectures?: readonly Conjecture[]): Board {
  if (conjectures && (
    conjectures.length < roundCount ||
    conjectures.some(({ prompt, verdict }) => !prompt.trim() || typeof verdict !== 'boolean') ||
    new Set(conjectures.map(({ prompt }) => prompt.trim())).size !== conjectures.length
  )) {
    throw new Error(`Provide at least ${roundCount} distinct conjecture prompts with fixed true/false verdicts.`);
  }

  const random = seededRandom(seed);
  const accuracies = preset === 'reliable-experts'
    ? shuffle(expertIds.map((_, index) => index < 2 ? 1 : 0.5), random)
    : expertIds.map(() => preset === 'coin-flip-experts' ? 0.5 : sampleTruncatedGaussian(random, 0.5, 0.25));
  const experts = expertIds.map((id, index) => ({ id, accuracy: accuracies[index] }));
  const selected = conjectures
    ? shuffle(conjectures, random).slice(0, roundCount)
    : Array.from({ length: roundCount }, () => ({ prompt: undefined, verdict: random() < 0.5 }));

  const rounds = selected.map(({ prompt, verdict }) => {
    const votes = {} as Record<ExpertId, boolean>;
    for (const { id, accuracy } of experts) {
      votes[id] = random() < accuracy ? verdict : !verdict;
    }
    return { prompt, verdict, votes };
  });
  return { experts, rounds };
}

export function startGame(): GameProgress {
  return { phase: 'guess', guesses: [] };
}

export function guessRound(progress: GameProgress, guess: boolean): GameProgress {
  if (progress.phase !== 'guess' || progress.guesses.length >= roundCount) return progress;
  return { phase: 'reveal', guesses: [...progress.guesses, guess] };
}

export function advanceRound(progress: GameProgress): GameProgress {
  if (progress.phase !== 'reveal') return progress;
  return { ...progress, phase: progress.guesses.length === roundCount ? 'finished' : 'guess' };
}

export function getRoundIndex(progress: GameProgress): number {
  return progress.phase === 'guess' ? progress.guesses.length : progress.guesses.length - 1;
}

function countCorrect(record: readonly boolean[]): number {
  return record.filter(Boolean).length;
}

/** Supplies only the current votes and the record a player can see at this point. */
export function viewRound(board: Board, progress: GameProgress, index: number): RoundView {
  if (!Number.isInteger(index) || index < 0 || index > getRoundIndex(progress)) {
    throw new RangeError('Cannot view a round ahead of the current one.');
  }
  const current = board.rounds[index];
  const guess = progress.guesses[index];
  const revealed = board.rounds.slice(0, Math.min(index + 1, progress.guesses.length));
  const experts = board.experts.map(({ id }) => {
    const record = revealed.map(({ verdict, votes }) => votes[id] === verdict);
    return { id, vote: current.votes[id], record, correct: countCorrect(record) };
  });
  return {
    number: index + 1,
    prompt: current.prompt,
    verdict: guess === undefined ? undefined : current.verdict,
    guess,
    experts,
  };
}

export function playerRecord(board: Board, progress: Pick<GameProgress, 'guesses'>): boolean[] {
  return progress.guesses.map((guess, index) => guess === board.rounds[index].verdict);
}

/** Compare the player's guesses with one fixed expert over the same prefix. */
export function scoreGuesses(board: Board, guesses: readonly boolean[]) {
  const rounds = board.rounds.slice(0, guesses.length);
  const record = playerRecord(board, { guesses });
  const experts = board.experts.map((expert) => ({
    ...expert,
    correct: countCorrect(rounds.map(({ verdict, votes }) => votes[expert.id] === verdict)),
  }));
  const best = Math.max(...experts.map(({ correct }) => correct));
  const playerCorrect = countCorrect(record);
  return {
    record,
    playerMistakes: guesses.length - playerCorrect,
    bestMistakes: guesses.length - best,
    regret: best - playerCorrect,
    bestExperts: experts.filter(({ correct }) => correct === best).map(({ id }) => id),
    experts,
  };
}

export function scoreBoard(board: Board, progress: GameProgress) {
  if (progress.phase !== 'finished') throw new Error('Finish all rounds before scoring the board.');
  return scoreGuesses(board, progress.guesses);
}

export type BoardScore = ReturnType<typeof scoreBoard>;
