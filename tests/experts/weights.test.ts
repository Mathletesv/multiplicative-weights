import test from 'node:test';
import assert from 'node:assert/strict';
import { expertIds } from '../../src/lib/experts/game.ts';
import { sampleTruncatedGaussian, seededRandom } from '../../src/lib/experts/random.ts';
import { createWeightRun, maxDecisions, minDecisions } from '../../src/lib/experts/weights.ts';

test('a repeatable run starts with ten unit weights and supports any integer horizon from 20 to 50', () => {
  const makeRun = (decisions: number) => createWeightRun(decisions, 17);
  assert.deepEqual(makeRun(30), makeRun(30));
  assert.notDeepEqual(makeRun(30), createWeightRun(30, 18));
  for (const decisions of [minDecisions, 39, maxDecisions]) {
    const { learningRate, frames } = makeRun(decisions);
    assert.equal(learningRate, Math.sqrt(Math.log(10) / decisions));
    assert.equal(frames.length, decisions + 1);
    const initial = frames[0];
    assert.equal(initial.cumulativeLoss, 0);
    assert.equal(initial.selected, undefined);
    assert.deepEqual(
      initial.experts.map(({ id, weight, cumulativeLoss, loss }) => ({ id, weight, cumulativeLoss, loss })),
      expertIds.map(id => ({ id, weight: 1, cumulativeLoss: 0, loss: undefined })),
    );
    const profiles = initial.experts.map(expert => expert.distribution);
    assert.equal(new Set(profiles.map(({ mean }) => mean)).size, expertIds.length);
    assert.equal(new Set(profiles.map(({ standardDeviation }) => standardDeviation)).size, expertIds.length);
  }
  for (const invalid of [19, 20.5, 51, NaN]) {
    assert.throws(() => makeRun(invalid), RangeError);
  }
  const losses = (decisions: number) => makeRun(decisions).frames.map(frame => frame.experts.map(expert => expert.loss));
  assert.deepEqual(losses(minDecisions), losses(maxDecisions).slice(0, minDecisions + 1));
});

test('each decision samples from the existing weights and applies the exponential loss update to all experts', () => {
  const seed = 17;
  const random = seededRandom(seed);
  const { learningRate, frames } = createWeightRun(50, seed);

  for (const [index, frame] of frames.slice(1).entries()) {
    const previous = frames[index].experts;
    const selected = previous.findIndex(expert => expert.id === frame.selected);
    assert.ok(selected >= 0);
    const total = previous.reduce((sum, expert) => sum + expert.weight, 0);
    const lower = previous.slice(0, selected).reduce((sum, expert) => sum + expert.weight, 0);
    const point = random() * total;
    assert.ok(point >= lower && point < lower + previous[selected].weight);
    assert.equal(frame.cumulativeLoss, frames[index].cumulativeLoss + frame.experts[selected].loss!);

    for (const [expertIndex, expert] of frame.experts.entries()) {
      assert.equal(expert.id, previous[expertIndex].id);
      const { mean, standardDeviation } = expert.distribution;
      assert.deepEqual(expert.distribution, previous[expertIndex].distribution);
      const loss = sampleTruncatedGaussian(random, mean, standardDeviation);
      assert.ok(loss >= 0 && loss <= 1);
      assert.equal(expert.loss, loss);
      assert.equal(expert.cumulativeLoss, previous[expertIndex].cumulativeLoss + loss);
      assert.equal(expert.weight, previous[expertIndex].weight * Math.exp(-learningRate * loss));
    }
  }
});

test('a new seed resamples the rounded Gaussian parameters while changing the horizon or epsilon retains them', () => {
  const profiles = (decisions: number, seed: number, epsilon?: number) =>
    createWeightRun(decisions, seed, epsilon).frames[0].experts.map(expert => expert.distribution);
  const initial = profiles(20, 17);
  assert.deepEqual(profiles(50, 17, 1), initial);
  assert.notDeepEqual(profiles(20, 18), initial);
  for (const { mean, standardDeviation } of initial) {
    assert.ok(mean >= 0.20 && mean <= 0.80);
    assert.ok(standardDeviation >= 0.06 && standardDeviation <= 0.23);
    assert.equal(Number(mean.toFixed(2)), mean);
    assert.equal(Number(standardDeviation.toFixed(2)), standardDeviation);
  }
});

test('Gaussian sampling redraws losses outside [0, 1] instead of assigning them to the endpoints', () => {
  const tail = 1 - Math.exp(-8);
  const draws = [tail, 0, tail, 0.5, 1 - Math.exp(-0.5), 0];
  let index = 0;
  const sample = sampleTruncatedGaussian(() => {
    assert.ok(index < draws.length);
    return draws[index++];
  }, 0.45, 0.2);
  assert.equal(index, draws.length);
  assert.ok(Math.abs(sample - 0.65) < 1e-12);
});

test('changing epsilon keeps the loss sequence and changes the weights', () => {
  const uniform = createWeightRun(30, 17, 0);
  const rapid = createWeightRun(30, 17, 1);
  assert.equal(uniform.learningRate, 0);
  assert.equal(rapid.learningRate, 1);
  assert.deepEqual(
    uniform.frames.map(frame => frame.experts.map(expert => expert.cumulativeLoss)),
    rapid.frames.map(frame => frame.experts.map(expert => expert.cumulativeLoss)),
  );
  assert.ok(uniform.frames.every(frame => frame.experts.every(expert => expert.weight === 1)));
  assert.ok(rapid.frames[30].experts.every(expert => expert.weight < 1));
  for (const invalid of [-0.1, 1.1, NaN, Infinity]) {
    assert.throws(() => createWeightRun(30, 17, invalid), /Epsilon must be between/);
  }
});
