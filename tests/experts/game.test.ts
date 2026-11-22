import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRound, createBoard, getRoundIndex, guessRound, playerRecord,
  roundCount, scoreBoard, scoreGuesses, startGame, viewRound,
} from '../../src/lib/experts/game.ts';

test('reliable preset produces ten repeatable rounds with two perfect experts and eight coin-flip experts', () => {
  const board = createBoard('reliable-experts', 3);
  assert.deepEqual(board, createBoard('reliable-experts', 3));
  assert.notDeepEqual(board, createBoard('reliable-experts', 1));
  assert.equal(board.rounds.length, roundCount);
  const reliable = board.experts.filter(({ accuracy }) => accuracy === 1);
  const random = board.experts.filter(({ accuracy }) => accuracy === 0.5);
  assert.equal(reliable.length, 2);
  assert.equal(random.length, 8);
  assert.ok(reliable.every(({ id }) => board.rounds.every(({ votes, verdict }) => votes[id] === verdict)));
  assert.ok(random.every(({ id }) => board.rounds.some(({ votes, verdict }) => votes[id] !== verdict)));
  const splits = board.rounds.slice(0, 5).filter(({ votes }) => Object.values(votes).filter(Boolean).length === 5);
  assert.ok(splits.length >= 2, 'the introductory board gives players early tie decisions');
});

test('mixed preset samples distinct probabilities inside (0, 1) and supports a lucky early streak', () => {
  const board = createBoard('mixed-accuracy', 8);
  assert.equal(new Set(board.experts.map(({ accuracy }) => accuracy)).size, 10);
  assert.ok(board.experts.some(({ id, accuracy }) => accuracy < 0.5 &&
    board.rounds.slice(0, 3).every(({ verdict, votes }) => votes[id] === verdict)));

  const samples = Array.from({ length: 512 }, (_, seed) => createBoard('mixed-accuracy', seed).experts)
    .flat().map(({ accuracy }) => accuracy);
  assert.ok(samples.every((accuracy) => accuracy > 0 && accuracy < 1));
  const mean = samples.reduce((sum, accuracy) => sum + accuracy, 0) / samples.length;
  const variance = samples.reduce((sum, accuracy) => sum + (accuracy - mean) ** 2, 0) / samples.length;
  assert.ok(Math.abs(mean - 0.5) < 0.015);
  // Rejecting the tails of N(0.50, 0.25²) at 0 and 1 lowers its realized spread to about 0.22.
  assert.ok(Math.abs(Math.sqrt(variance) - 0.22) < 0.01);
});

test('coin-flip boards give all ten experts fair votes against either verdict', () => {
  const board = createBoard('coin-flip-experts', 11);
  assert.deepEqual(board, createBoard('coin-flip-experts', 11));
  assert.equal(board.experts.length, 10);
  assert.ok(board.experts.every(({ accuracy }) => accuracy === 0.5));

  const rounds = Array.from({ length: 128 }, (_, seed) => createBoard('coin-flip-experts', seed).rounds).flat();
  for (const verdict of [true, false]) {
    const votes = rounds.filter(round => round.verdict === verdict).flatMap(round => Object.values(round.votes));
    const trueRate = votes.filter(Boolean).length / votes.length;
    assert.ok(Math.abs(trueRate - 0.5) < 0.025);
  }
});

test('a custom conjecture keeps its verdict when shuffled or replayed', () => {
  const conjectures = Array.from({ length: 12 }, (_, index) => ({ prompt: `Fixture ${index}`, verdict: index % 2 === 0 }));
  for (const seed of [1, 5, 207]) {
    const board = createBoard('mixed-accuracy', seed, conjectures);
    assert.equal(new Set(board.rounds.map(({ prompt }) => prompt)).size, roundCount);
    for (const { prompt, verdict } of board.rounds) {
      assert.equal(verdict, conjectures.find((entry) => entry.prompt === prompt)?.verdict);
    }
  }
  assert.throws(() => createBoard('reliable-experts', 1, conjectures.slice(0, 9)), /at least 10 distinct conjecture/);
  assert.throws(() => createBoard('reliable-experts', 1, Array(10).fill(conjectures[0])), /at least 10 distinct conjecture/);
});

test('feedback and records reveal only after a committed guess', () => {
  const board = createBoard('reliable-experts', 1);
  const initial = startGame();
  const first = viewRound(board, initial, 0);
  assert.equal(first.verdict, undefined);
  assert.equal(first.guess, undefined);
  assert.ok(first.experts.every(({ record }) => record.length === 0));
  assert.throws(() => viewRound(board, initial, 1), /ahead of the current one/);
  assert.equal(advanceRound(initial), initial);
  assert.throws(() => scoreBoard(board, initial), /Finish all rounds/);

  const guessed = guessRound(initial, false);
  assert.equal(guessRound(guessed, true), guessed);
  const revealed = viewRound(board, guessed, 0);
  assert.equal(revealed.guess, false);
  assert.equal(revealed.verdict, board.rounds[0].verdict);
  assert.ok(revealed.experts.every(({ id, record }) => record.length === 1 &&
    record[0] === (board.rounds[0].votes[id] === revealed.verdict)));

  const second = advanceRound(guessed);
  assert.equal(getRoundIndex(second), 1);
  assert.equal(viewRound(board, second, 1).verdict, undefined);
  assert.ok(viewRound(board, second, 1).experts.every(({ record }) => record.length === 1));
});

test('results report all best fixed experts and preserve earlier records when reviewing', () => {
  const board = createBoard('reliable-experts', 3);
  let progress = startGame();
  for (const [index, round] of board.rounds.entries()) {
    progress = guessRound(progress, index % 2 ? !round.verdict : round.verdict);
    assert.equal(progress.phase, 'reveal');
    assert.equal(viewRound(board, progress, index).verdict, round.verdict);
    progress = advanceRound(progress);
  }
  assert.equal(progress.phase, 'finished');
  assert.equal(guessRound(progress, true), progress);
  assert.equal(advanceRound(progress), progress);
  const score = scoreBoard(board, progress);
  assert.equal(score.playerMistakes, 5);
  assert.equal(score.bestMistakes, 0);
  assert.deepEqual(score.bestExperts, board.experts.filter(({ accuracy }) => accuracy === 1).map(({ id }) => id));
  assert.deepEqual(score.record, playerRecord(board, progress));
  assert.ok(viewRound(board, progress, 1).experts.every(({ record }) => record.length === 2));
});

test('realized regret uses one best fixed expert over the answered prefix and can be negative', () => {
  const board = createBoard('mixed-accuracy', 8);
  // A is right only in round one. Every other expert is right only in round two.
  const rounds = board.rounds.slice(0, 2).map((round, index) => ({
    ...round, verdict: true,
    votes: Object.fromEntries(board.experts.map(({ id }) => [id, (id === 'A') === (index === 0)])) as typeof round.votes,
  }));
  const example = { ...board, rounds };
  assert.equal(scoreGuesses(example, []).regret, 0);
  assert.equal(scoreGuesses(example, [false]).regret, 1);
  assert.equal(scoreGuesses(example, [true, true]).regret, -1);
  const score = scoreGuesses(example, [false, true]);
  assert.equal(score.bestMistakes, 1);
  assert.equal(score.playerMistakes, 1);
  assert.equal(score.regret, 0);
});
