import { describe, expect, it } from "vitest";
import type { EngineResult } from "../engine/engine";
import type { MoveChoice } from "../types";
import { getLevel, LEVELS, pickOpponentMove } from "./levels";

const LEGAL: MoveChoice[] = [
  { from: "a2", to: "a3" },
  { from: "e2", to: "e4" },
  { from: "g1", to: "f3" },
];
const ENGINE_SAYS_E4: EngineResult = { bestMove: { from: "e2", to: "e4" }, lines: [] };

/** A stand-in for Math.random that returns the given numbers in order. */
function fixedRandom(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("levels", () => {
  it("has three levels that get steadily harder", () => {
    expect(LEVELS.map((level) => level.id)).toEqual(["beginner", "casual", "challenger"]);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].skillLevel).toBeGreaterThan(LEVELS[i - 1].skillLevel);
      expect(LEVELS[i].depth).toBeGreaterThan(LEVELS[i - 1].depth);
      expect(LEVELS[i].randomMoveChance).toBeLessThan(LEVELS[i - 1].randomMoveChance);
    }
  });

  it("looks a level up by id", () => {
    expect(getLevel("casual").name).toBe("Casual");
  });
});

describe("pickOpponentMove", () => {
  it("plays the engine's move when it does not roll a random one", () => {
    const move = pickOpponentMove(ENGINE_SAYS_E4, LEGAL, getLevel("beginner"), fixedRandom(0.99));
    expect(move).toEqual({ from: "e2", to: "e4" });
  });

  it("plays a random legal move when the roll is under the level's chance", () => {
    // First number decides "go random", second picks the last legal move.
    const move = pickOpponentMove(ENGINE_SAYS_E4, LEGAL, getLevel("beginner"), fixedRandom(0.1, 0.9));
    expect(move).toEqual({ from: "g1", to: "f3" });
  });

  it("never plays randomly on the hardest level", () => {
    const move = pickOpponentMove(ENGINE_SAYS_E4, LEGAL, getLevel("challenger"), fixedRandom(0));
    expect(move).toEqual({ from: "e2", to: "e4" });
  });

  it("falls back to a legal move if the engine's answer is missing or illegal", () => {
    const never = fixedRandom(0.99);
    const level = getLevel("challenger");
    expect(pickOpponentMove({ bestMove: null, lines: [] }, LEGAL, level, never)).toEqual(LEGAL[0]);
    const illegal: EngineResult = { bestMove: { from: "h1", to: "h8" }, lines: [] };
    expect(pickOpponentMove(illegal, LEGAL, level, never)).toEqual(LEGAL[0]);
  });

  it("returns null when there are no legal moves", () => {
    expect(pickOpponentMove(ENGINE_SAYS_E4, [], getLevel("beginner"))).toBeNull();
  });
});
