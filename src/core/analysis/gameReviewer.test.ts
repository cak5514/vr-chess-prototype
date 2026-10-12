import { describe, expect, it, vi } from "vitest";
import type { ChessEngine, EngineLine, EngineRequest, EngineResult } from "../engine/engine";
import { Game } from "../game/game";
import type { MoveChoice } from "../types";
import { GameReviewer } from "./gameReviewer";

/**
 * A fake engine that looks its answer up by position. Positions it has not
 * been told about get a quiet "equal" answer.
 */
class ScriptedEngine implements ChessEngine {
  requests: EngineRequest[] = [];
  private answers = new Map<string, EngineLine>();
  failNext = false;

  /** `placement` is the first part of a FEN, which is enough to recognise a position. */
  answer(placement: string, move: MoveChoice, score: { cp?: number; mate?: number }): void {
    this.answers.set(placement, { move, pv: [move], scoreCp: score.cp, mateIn: score.mate });
  }

  async analyse(request: EngineRequest): Promise<EngineResult> {
    this.requests.push(request);
    if (this.failNext) {
      this.failNext = false;
      throw new Error("engine crashed");
    }
    const line = this.answers.get(request.fen.split(" ")[0]) ?? {
      move: { from: "a2", to: "a3" },
      pv: [],
      scoreCp: 0,
    };
    return { bestMove: line.move, lines: [line] };
  }

  dispose(): void {}
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const AFTER_F3 = "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR";
const AFTER_F3_E5 = "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR";
const AFTER_F3_E5_G4 = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR";

function setup() {
  const game = new Game();
  const engine = new ScriptedEngine();
  const reviewer = new GameReviewer(game, engine);
  return { game, engine, reviewer };
}

describe("GameReviewer", () => {
  it("does nothing until it knows which side the player is", async () => {
    const { game, engine, reviewer } = setup();
    game.attemptMove("e2", "e4");
    await reviewer.whenIdle();
    expect(engine.requests).toHaveLength(0);
    expect(reviewer.getReviews()).toEqual([]);
  });

  it("reviews the player's moves and leaves the opponent's alone", async () => {
    const { game, engine, reviewer } = setup();
    engine.answer(START, { from: "e2", to: "e4" }, { cp: 30 });
    reviewer.setPlayerColor("white");

    game.attemptMove("e2", "e4");
    game.attemptMove("e7", "e5");
    await reviewer.whenIdle();

    expect(reviewer.getReviews()).toMatchObject([{ ply: 0, san: "e4", quality: "best" }]);
    // One question was enough, because the player found the best move.
    expect(engine.requests).toHaveLength(1);
    expect(engine.requests[0]).toMatchObject({ depth: 10, skillLevel: 20 });
  });

  it("asks a second question when the player chose a different move", async () => {
    const { game, engine, reviewer } = setup();
    engine.answer(START, { from: "e2", to: "e4" }, { cp: 30 });
    engine.answer(AFTER_F3, { from: "e7", to: "e5" }, { cp: 60 });
    reviewer.setPlayerColor("white");

    game.attemptMove("f2", "f3");
    await reviewer.whenIdle();

    expect(engine.requests).toHaveLength(2);
    // Best was +30; after f3 the opponent is +60, so we are -60: a loss of 90.
    expect(reviewer.getReviews()).toMatchObject([{ san: "f3", quality: "inaccuracy", lossCp: 90 }]);
  });

  it("finds the blunder in fool's mate", async () => {
    const { game, engine, reviewer } = setup();
    engine.answer(AFTER_F3_E5, { from: "e2", to: "e4" }, { cp: -40 });
    engine.answer(AFTER_F3_E5_G4, { from: "d8", to: "h4" }, { mate: 1 });
    reviewer.setPlayerColor("white");

    game.attemptMove("f2", "f3");
    game.attemptMove("e7", "e5");
    game.attemptMove("g2", "g4");
    await reviewer.whenIdle();

    const blunder = reviewer.getReviews().find((review) => review.san === "g4");
    expect(blunder).toMatchObject({ quality: "blunder", theme: "allowed-mate", moveNumber: 2 });
  });

  it("drops the review of a move that is undone", async () => {
    const { game, reviewer } = setup();
    reviewer.setPlayerColor("white");
    game.attemptMove("e2", "e4");
    await reviewer.whenIdle();
    expect(reviewer.getReviews()).toHaveLength(1);

    game.undo();
    expect(reviewer.getReviews()).toEqual([]);

    // A different move in the same place gets its own review.
    game.attemptMove("d2", "d4");
    await reviewer.whenIdle();
    expect(reviewer.getReviews()).toMatchObject([{ san: "d4" }]);
  });

  it("starts fresh on a new game", async () => {
    const { game, reviewer } = setup();
    reviewer.setPlayerColor("white");
    game.attemptMove("e2", "e4");
    await reviewer.whenIdle();
    game.newGame();
    expect(reviewer.getReviews()).toEqual([]);
  });

  it("skips a move that was undone before the engine got to it", async () => {
    const { game, engine, reviewer } = setup();
    reviewer.setPlayerColor("white");
    game.attemptMove("e2", "e4");
    game.undo(); // undone while still waiting in the queue
    await reviewer.whenIdle();
    expect(engine.requests).toHaveLength(0);
    expect(reviewer.pendingCount()).toBe(0);
  });

  it("counts pending moves and tells listeners when a review arrives", async () => {
    const { game, reviewer } = setup();
    const listener = vi.fn();
    reviewer.setPlayerColor("white");
    reviewer.onChange(listener);

    game.attemptMove("e2", "e4");
    expect(reviewer.pendingCount()).toBe(1);
    await reviewer.whenIdle();
    expect(reviewer.pendingCount()).toBe(0);
    expect(listener).toHaveBeenCalled();
  });

  it("carries on if the engine fails for one move", async () => {
    const { game, engine, reviewer } = setup();
    reviewer.setPlayerColor("white");
    engine.failNext = true;
    game.attemptMove("e2", "e4");
    game.attemptMove("e7", "e5");
    game.attemptMove("g1", "f3");
    await reviewer.whenIdle();
    // The first move is unreviewed, the second is fine.
    expect(reviewer.getReviews().map((review) => review.san)).toEqual(["Nf3"]);
  });

  it("reviews black's moves when the player is black", async () => {
    const { game, reviewer } = setup();
    reviewer.setPlayerColor("black");
    game.attemptMove("e2", "e4");
    game.attemptMove("e7", "e5");
    await reviewer.whenIdle();
    expect(reviewer.getReviews()).toMatchObject([{ ply: 1, san: "e5", moveNumber: 1 }]);
  });
});
