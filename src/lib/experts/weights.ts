import { expertIds } from './game.ts';
import type { ExpertId } from './game.ts';
import { sampleTruncatedGaussian, seededRandom, shuffle } from './random.ts';

export const minDecisions = 20;
export const maxDecisions = 50;
export const minEpsilon = 0;
export const maxEpsilon = 1;

interface GaussianParameters {
  readonly mean: number;
  readonly standardDeviation: number;
}

function hundredthsBetween(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => (first + index) / 100);
}

const gaussianMeans = hundredthsBetween(20, 80);
const gaussianStandardDeviations = hundredthsBetween(6, 23);

export interface ExpertWeight {
  id: ExpertId;
  distribution: GaussianParameters;
  loss?: number;
  cumulativeLoss: number;
  weight: number;
}

export interface WeightFrame {
  experts: readonly ExpertWeight[];
  selected?: ExpertId;
  cumulativeLoss: number;
}

function sampleExpertIndex(experts: readonly ExpertWeight[], randomValue: number): number {
  const total = experts.reduce((sum, { weight }) => sum + weight, 0);
  const threshold = randomValue * total;
  let cumulative = 0;
  for (const [index, { weight }] of experts.entries()) {
    cumulative += weight;
    if (threshold < cumulative) return index;
  }
  return experts.length - 1;
}

/** Each frame pairs the losses just observed with the weights after their update. */
export function createWeightRun(
  decisions: number,
  seed: number,
  learningRate = Math.sqrt(Math.log(expertIds.length) / decisions),
) {
  if (!Number.isInteger(decisions) || decisions < minDecisions || decisions > maxDecisions) {
    throw new RangeError(`Choose an integer between ${minDecisions} and ${maxDecisions} decisions.`);
  }
  if (!Number.isFinite(learningRate) || learningRate < minEpsilon || learningRate > maxEpsilon) {
    throw new RangeError(`Epsilon must be between ${minEpsilon} and ${maxEpsilon}.`);
  }
  // Keep setup draws separate from the draws used to select experts and sample losses.
  const parameterRandom = seededRandom(~seed);
  const means = shuffle(gaussianMeans, parameterRandom);
  const standardDeviations = shuffle(gaussianStandardDeviations, parameterRandom);
  const random = seededRandom(seed);
  let experts: readonly ExpertWeight[] = expertIds.map((id, index) => ({
    id,
    distribution: { mean: means[index], standardDeviation: standardDeviations[index] },
    weight: 1,
    cumulativeLoss: 0,
  }));
  let algorithmLoss = 0;
  const frames: WeightFrame[] = [{ experts, cumulativeLoss: algorithmLoss }];

  for (let decision = 0; decision < decisions; decision++) {
    const selectedIndex = sampleExpertIndex(experts, random());
    const updated = experts.map(expert => {
      const { mean, standardDeviation } = expert.distribution;
      const loss = sampleTruncatedGaussian(random, mean, standardDeviation);
      return {
        ...expert,
        loss,
        cumulativeLoss: expert.cumulativeLoss + loss,
        weight: expert.weight * Math.exp(-learningRate * loss),
      };
    });
    const selected = updated[selectedIndex];
    algorithmLoss += selected.loss;
    frames.push({ experts: updated, selected: selected.id, cumulativeLoss: algorithmLoss });
    experts = updated;
  }

  return { learningRate, frames };
}
