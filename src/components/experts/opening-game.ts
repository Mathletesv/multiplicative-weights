import { writable } from 'svelte/store';
import type { Board, GameProgress } from '../../lib/experts/game';

// Shared by the two islands on the experts page. Written only by browser interactions.
export const openingGame = writable<{ board: Board; progress: GameProgress } | undefined>(undefined);
