import type { GameSummary } from "../feedback/summary";
import type { KeyValueStore } from "../progress/progress";
import type { DifficultyLevel } from "./levels";

// Adaptive difficulty: the computer gets a little stronger after the player
// does well and a little weaker after the player struggles. This is the
// "AI opponent that adjusts its difficulty according to the beginner's
// playing performance" from the project proposal.

export const MIN_RATING = 1;
export const MAX_RATING = 10;
/** New players start near the bottom, where the computer makes many mistakes. */
export const STARTING_RATING = 2;

const STORAGE_KEY = "vr-chess-academy.adaptive-rating";

/**
 * The engine settings for each step of the ladder, weakest first.
 * [Stockfish skill, search depth, chance of a random move]
 * Steps 2, 5 and 8 match the fixed Beginner, Casual and Challenger levels.
 */
const LADDER: [skillLevel: number, depth: number, randomMoveChance: number][] = [
  [0, 1, 0.5],
  [0, 1, 0.4],
  [0, 2, 0.28],
  [1, 2, 0.2],
  [2, 3, 0.15],
  [3, 4, 0.08],
  [4, 5, 0.04],
  [6, 6, 0],
  [8, 7, 0],
  [10, 8, 0],
];

function clamp(rating: number): number {
  return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(rating)));
}

/** The opponent settings for a rating from 1 to 10. */
export function levelForRating(rating: number): DifficultyLevel {
  const step = clamp(rating);
  const [skillLevel, depth, randomMoveChance] = LADDER[step - 1];
  return {
    id: "adaptive",
    name: `Adaptive (level ${step} of ${MAX_RATING})`,
    description: "Adjusts to how you play.",
    skillLevel,
    depth,
    randomMoveChance,
  };
}

/** How one finished game changes the rating, and why. */
export interface RatingChange {
  before: number;
  after: number;
  reason: string;
}

/**
 * Decides the new rating from the result of a game and how well it was played.
 *
 * - A win moves the player up one step, or two after a clean win.
 * - A loss moves the player down one step, unless they made no blunders,
 *   in which case the level was about right and stays.
 * - A draw changes nothing.
 */
export function rateGame(rating: number, summary: GameSummary): RatingChange {
  const before = clamp(rating);
  const { blunder, mistake } = summary.counts;
  let step = 0;
  let reason = "A draw, so the level stays the same.";

  if (summary.result === "win") {
    const cleanWin = blunder === 0 && mistake <= 1;
    step = cleanWin ? 2 : 1;
    reason = cleanWin
      ? "You won with almost no mistakes, so the computer moves up two levels."
      : "You won, so the computer moves up a level.";
  } else if (summary.result === "loss") {
    // Judged by serious errors, not by the share of good moves: in a long
    // lost game most moves look "good" simply because nothing was left to lose.
    const playedWell = blunder === 0 && mistake <= 2;
    step = playedWell ? 0 : -1;
    reason = playedWell
      ? "You lost, but without any blunders, so the level stays the same."
      : "That was a tough game, so the computer moves down a level.";
  }

  const after = clamp(before + step);
  if (after === before && step > 0) reason = "You won at the highest level. There is nothing harder to offer!";
  if (after === before && step < 0) reason = "This is already the easiest level, so it stays the same.";
  return { before, after, reason };
}

/** Keeps the player's adaptive rating and saves it between visits. */
export class AdaptiveDifficulty {
  private rating: number;

  constructor(private store: KeyValueStore) {
    const saved = Number(store.get(STORAGE_KEY));
    // Anything missing or damaged falls back to the starting rating.
    this.rating = Number.isFinite(saved) && saved >= MIN_RATING ? clamp(saved) : STARTING_RATING;
  }

  getRating(): number {
    return this.rating;
  }

  getLevel(): DifficultyLevel {
    return levelForRating(this.rating);
  }

  /** Updates the rating after a finished game and returns what changed. */
  recordGame(summary: GameSummary): RatingChange {
    const change = rateGame(this.rating, summary);
    this.rating = change.after;
    this.store.set(STORAGE_KEY, String(this.rating));
    return change;
  }
}
