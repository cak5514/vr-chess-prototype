import { describe, expect, it } from "vitest";
import type { GameSummary } from "../feedback/summary";
import type { KeyValueStore } from "../progress/progress";
import { AdaptiveDifficulty, levelForRating, MAX_RATING, MIN_RATING, rateGame, STARTING_RATING } from "./adaptive";
import { getLevel } from "./levels";

function summary(
  result: GameSummary["result"],
  counts: Partial<GameSummary["counts"]> = {},
  goodMovePercent: number | null = 50,
): GameSummary {
  return {
    result,
    resultText: "",
    playerMoves: 20,
    capturesByPlayer: 0,
    capturesByOpponent: 0,
    counts: { good: 10, inaccuracy: 0, mistake: 0, blunder: 0, ...counts },
    goodMovePercent,
    keyMistakes: [],
    recommendations: [],
  };
}

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = { ...initial };
  return {
    get: (key) => data[key] ?? null,
    set: (key, value) => {
      data[key] = value;
    },
  };
}

describe("levelForRating", () => {
  it("gets steadily stronger from 1 to 10", () => {
    for (let rating = MIN_RATING + 1; rating <= MAX_RATING; rating++) {
      const easier = levelForRating(rating - 1);
      const harder = levelForRating(rating);
      expect(harder.skillLevel).toBeGreaterThanOrEqual(easier.skillLevel);
      expect(harder.depth).toBeGreaterThanOrEqual(easier.depth);
      expect(harder.randomMoveChance).toBeLessThanOrEqual(easier.randomMoveChance);
      // At least one of the three settings must actually change.
      expect([harder.skillLevel, harder.depth, harder.randomMoveChance]).not.toEqual([
        easier.skillLevel,
        easier.depth,
        easier.randomMoveChance,
      ]);
    }
  });

  it("lines up with the three fixed levels", () => {
    for (const [rating, id] of [[2, "beginner"], [5, "casual"], [8, "challenger"]] as const) {
      const fixed = getLevel(id);
      expect(levelForRating(rating)).toMatchObject({
        skillLevel: fixed.skillLevel,
        depth: fixed.depth,
        randomMoveChance: fixed.randomMoveChance,
      });
    }
  });

  it("names the level and stays inside 1 to 10", () => {
    expect(levelForRating(3).name).toBe("Adaptive (level 3 of 10)");
    expect(levelForRating(0)).toEqual(levelForRating(1));
    expect(levelForRating(99)).toEqual(levelForRating(10));
  });
});

describe("rateGame", () => {
  it("moves up one level after a win", () => {
    const change = rateGame(3, summary("win", { blunder: 1 }));
    expect(change).toMatchObject({ before: 3, after: 4 });
    expect(change.reason).toContain("up a level");
  });

  it("moves up two levels after a clean win", () => {
    expect(rateGame(3, summary("win", { mistake: 1 }))).toMatchObject({ after: 5 });
    expect(rateGame(3, summary("win")).reason).toContain("two levels");
  });

  it("moves down one level after a loss", () => {
    const change = rateGame(4, summary("loss", { blunder: 3 }, 40));
    expect(change).toMatchObject({ before: 4, after: 3 });
  });

  it("stays put after a loss that was played well", () => {
    const change = rateGame(4, summary("loss", { mistake: 2 }));
    expect(change.after).toBe(4);
    expect(change.reason).toContain("without any blunders");
  });

  it("is not fooled by a high share of good moves in a long lost game", () => {
    // 88% of moves were "good", but there were three blunders.
    expect(rateGame(4, summary("loss", { blunder: 3, mistake: 2 }, 88)).after).toBe(3);
  });

  it("stays put after a draw", () => {
    expect(rateGame(4, summary("draw")).after).toBe(4);
  });

  it("never leaves the range 1 to 10", () => {
    const top = rateGame(MAX_RATING, summary("win"));
    expect(top.after).toBe(MAX_RATING);
    expect(top.reason).toContain("highest level");

    const bottom = rateGame(MIN_RATING, summary("loss", { blunder: 5 }, 10));
    expect(bottom.after).toBe(MIN_RATING);
    expect(bottom.reason).toContain("easiest level");

    expect(rateGame(9, summary("win")).after).toBe(MAX_RATING);
  });
});

describe("AdaptiveDifficulty", () => {
  it("starts new players at the starting rating", () => {
    const adaptive = new AdaptiveDifficulty(memoryStore());
    expect(adaptive.getRating()).toBe(STARTING_RATING);
    expect(adaptive.getLevel().id).toBe("adaptive");
  });

  it("changes its level after each game", () => {
    const adaptive = new AdaptiveDifficulty(memoryStore());
    expect(adaptive.recordGame(summary("win", { blunder: 1 }))).toMatchObject({ before: 2, after: 3 });
    expect(adaptive.getRating()).toBe(3);
    expect(adaptive.getLevel()).toEqual(levelForRating(3));
  });

  it("remembers the rating on the next visit", () => {
    const store = memoryStore();
    new AdaptiveDifficulty(store).recordGame(summary("win"));
    expect(new AdaptiveDifficulty(store).getRating()).toBe(4);
  });

  it("ignores a saved rating that is damaged", () => {
    const key = "vr-chess-academy.adaptive-rating";
    expect(new AdaptiveDifficulty(memoryStore({ [key]: "banana" })).getRating()).toBe(STARTING_RATING);
    expect(new AdaptiveDifficulty(memoryStore({ [key]: "-4" })).getRating()).toBe(STARTING_RATING);
    expect(new AdaptiveDifficulty(memoryStore({ [key]: "50" })).getRating()).toBe(MAX_RATING);
  });
});
