import type { EngineResult } from "../engine/engine";
import type { MoveChoice } from "../types";

export type LevelId = "beginner" | "casual" | "challenger";

/** The settings that make the computer easier or harder to beat. */
export interface DifficultyLevel {
  /** One of the fixed levels, or "adaptive" for a level chosen from the player's rating. */
  id: LevelId | "adaptive";
  name: string;
  description: string;
  /** Stockfish's own strength setting, 0 (weakest) to 20. */
  skillLevel: number;
  /** How many half-moves ahead the engine looks. */
  depth: number;
  /**
   * How often (0 to 1) the computer ignores the engine and plays a random
   * legal move. Even Stockfish's weakest setting is too strong for someone
   * playing their first games, so the easy levels blunder on purpose.
   */
  randomMoveChance: number;
}

export const LEVELS: DifficultyLevel[] = [
  {
    id: "beginner",
    name: "Beginner",
    description: "Makes lots of mistakes. Best for your first games.",
    skillLevel: 0,
    depth: 1,
    randomMoveChance: 0.4,
  },
  {
    id: "casual",
    name: "Casual",
    description: "Plays sensible moves but still slips up.",
    skillLevel: 2,
    depth: 3,
    randomMoveChance: 0.15,
  },
  {
    id: "challenger",
    name: "Challenger",
    description: "Rarely gives pieces away. A real test for a beginner.",
    skillLevel: 6,
    depth: 6,
    randomMoveChance: 0,
  },
];

export function getLevel(id: LevelId): DifficultyLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

function sameMove(a: MoveChoice, b: MoveChoice): boolean {
  return a.from === b.from && a.to === b.to && a.promotion === b.promotion;
}

/**
 * Decides which move the computer actually plays.
 *
 * `random` returns a number from 0 to 1. It is a parameter so tests can
 * pass fixed numbers instead of real randomness.
 */
export function pickOpponentMove(
  result: EngineResult,
  legalMoves: MoveChoice[],
  level: DifficultyLevel,
  random: () => number = Math.random,
): MoveChoice | null {
  if (legalMoves.length === 0) return null;

  if (random() < level.randomMoveChance) {
    return legalMoves[Math.floor(random() * legalMoves.length)];
  }

  // Use the engine's move, but only if it really is legal here.
  const engineMove = result.bestMove;
  const legalEngineMove = engineMove && legalMoves.find((move) => sameMove(move, engineMove));
  return legalEngineMove ?? legalMoves[0];
}
