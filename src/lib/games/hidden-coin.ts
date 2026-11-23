export type Box = 'red' | 'blue';

const foundPayoff: Readonly<Record<Box, number>> = { red: 1, blue: 0.5 };
export const hiderEpsilon = 0.5;

export function hiddenCoinExpectation(hideRed: number, pickRed: number) {
  const redMatch = hideRed * pickRed;
  const blueMatch = (1 - hideRed) * (1 - pickRed);
  const miss = hideRed * (1 - pickRed) + (1 - hideRed) * pickRed;
  return {
    redMatch,
    blueMatch,
    miss,
    expectedPayoff: redMatch * foundPayoff.red + blueMatch * foundPayoff.blue,
  };
}

export interface HiderRound {
  hidden: Box;
  picked: Box;
  payoff: number;
}

export interface HiderGame {
  readonly logWeights: Readonly<Record<Box, number>>;
  readonly hidden: Box;
  readonly rounds: number;
  readonly totalPayoff: number;
  readonly expectedTotalPayoff: number;
  readonly lastRound?: HiderRound;
}

/** Bob's payoff is Alice's loss. Work in log weights for games of any length. */
export function hideRedProbability({ logWeights }: Pick<HiderGame, 'logWeights'>): number {
  return 1 / (1 + Math.exp(logWeights.blue - logWeights.red));
}

export function hiderRegret({ logWeights, expectedTotalPayoff }: HiderGame): number {
  // Each log weight is the negative cumulative payoff for that fixed hide, multiplied by ε.
  const bestFixedPayoff = -Math.max(logWeights.red, logWeights.blue) / hiderEpsilon;
  return expectedTotalPayoff - bestFixedPayoff;
}

export function startHiderGame(draw: number): HiderGame {
  return {
    logWeights: { red: 0, blue: 0 },
    hidden: draw < 0.5 ? 'red' : 'blue',
    rounds: 0,
    totalPayoff: 0,
    expectedTotalPayoff: 0,
  };
}

/** Resolve the committed hide, then update the weights and commit the next hide. */
export function playHiderRound(game: HiderGame, picked: Box, nextDraw: number): HiderGame {
  const payoff = game.hidden === picked ? foundPayoff[picked] : 0;
  const { expectedPayoff } = hiddenCoinExpectation(hideRedProbability(game), picked === 'red' ? 1 : 0);
  const logWeights = {
    ...game.logWeights,
    [picked]: game.logWeights[picked] - hiderEpsilon * foundPayoff[picked],
  };
  return {
    logWeights,
    hidden: nextDraw < hideRedProbability({ logWeights }) ? 'red' : 'blue',
    rounds: game.rounds + 1,
    totalPayoff: game.totalPayoff + payoff,
    expectedTotalPayoff: game.expectedTotalPayoff + expectedPayoff,
    lastRound: { hidden: game.hidden, picked, payoff },
  };
}
