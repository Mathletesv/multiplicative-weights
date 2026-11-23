import test from 'node:test';
import assert from 'node:assert/strict';
import { hiddenCoinExpectation, hideRedProbability, hiderRegret, playHiderRound, startHiderGame } from '../../src/lib/games/hidden-coin.ts';

test('the calculator weights the two match payoffs by their joint probabilities', () => {
  assert.deepEqual(hiddenCoinExpectation(0.5, 0.5), {
    redMatch: 0.25, blueMatch: 0.25, miss: 0.5, expectedPayoff: 0.375,
  });
  assert.equal(hiddenCoinExpectation(1, 1).expectedPayoff, 1);
  assert.equal(hiddenCoinExpectation(0, 0).expectedPayoff, 0.5);
  assert.equal(hiddenCoinExpectation(1, 0).expectedPayoff, 0);
  assert.equal(hiddenCoinExpectation(0, 1).expectedPayoff, 0);
  for (const pickRed of [0, 0.25, 0.5, 1]) {
    const { expectedPayoff, redMatch, blueMatch, miss } = hiddenCoinExpectation(1 / 3, pickRed);
    assert.ok(Math.abs(expectedPayoff - 1 / 3) < 1e-12);
    assert.ok(Math.abs(redMatch + blueMatch + miss - 1) < 1e-12);
  }
});

test('Alice settles the committed hide and updates against both possible hiding places', () => {
  const start = startHiderGame(0.1);
  assert.equal(hideRedProbability(start), 0.5);
  const miss = playHiderRound(start, 'blue', 0.55);
  assert.deepEqual(miss.lastRound, { hidden: 'red', picked: 'blue', payoff: 0 });
  assert.deepEqual(miss.logWeights, { red: 0, blue: -0.25 });
  assert.equal(miss.hidden, 'red');
  assert.ok(hideRedProbability(miss) > 0.55);

  const redMatch = playHiderRound(miss, 'red', 0.9);
  assert.deepEqual(redMatch.lastRound, { hidden: 'red', picked: 'red', payoff: 1 });
  assert.deepEqual(redMatch.logWeights, { red: -0.5, blue: -0.25 });
  assert.equal(redMatch.hidden, 'blue');
  const blueMatch = playHiderRound(redMatch, 'blue', 0.1);
  assert.deepEqual(blueMatch.lastRound, { hidden: 'blue', picked: 'blue', payoff: 0.5 });
  assert.equal(blueMatch.rounds, 3);
  assert.equal(blueMatch.totalPayoff, 1.5);
  assert.equal(hideRedProbability(blueMatch), 0.5);
});

test('a long run can recover equal weights after repeated penalties to one box', () => {
  let game = startHiderGame(0.5);
  for (let round = 0; round < 2000; round++) game = playHiderRound(game, 'red', 0.5);
  assert.equal(hideRedProbability(game), 0);
  for (let round = 0; round < 4000; round++) game = playHiderRound(game, 'blue', 0.5);
  assert.equal(hideRedProbability(game), 0.5);
});

test('regret uses the distribution before each pick and the cheapest fixed hide so far', () => {
  const start = startHiderGame(0.8);
  assert.equal(hiderRegret(start), 0);

  const first = playHiderRound(start, 'red', 0.9);
  assert.equal(first.totalPayoff, 0);
  assert.equal(hiderRegret(first), 0.5);

  const second = playHiderRound(first, 'blue', 0.1);
  const blueProbability = 1 - hideRedProbability(first);
  assert.equal(second.totalPayoff, 0.5);
  assert.ok(Math.abs(hiderRegret(second) - 0.5 * blueProbability) < 1e-12);

  const third = playHiderRound(second, 'blue', 0.1);
  const fourth = playHiderRound(third, 'blue', 0.1);
  assert.equal(hiderRegret(fourth), fourth.expectedTotalPayoff - 1);
});
