import { describe, expect, it, vi } from "vitest";
import { getLevel } from "../difficulty/levels";
import type { ChessEngine, EngineRequest, EngineResult } from "../engine/engine";
import { Game } from "../game/game";
import type { MoveChoice } from "../types";
import { ComputerOpponent } from "./computerOpponent";

/**
 * A fake engine. Each search waits until the test calls reply(), so tests
 * control exactly when the "engine" answers.
 */
class FakeEngine implements ChessEngine {
  requests: EngineRequest[] = [];
  private pending: { resolve(result: EngineResult): void; reject(error: Error): void }[] = [];

  analyse(request: EngineRequest): Promise<EngineResult> {
    this.requests.push(request);
    return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
  }

  dispose(): void {}

  /** Answers the oldest unanswered search. */
  async reply(move: MoveChoice | null): Promise<void> {
    this.pending.shift()!.resolve({ bestMove: move, lines: [] });
    await settle();
  }

  async fail(message: string): Promise<void> {
    this.pending.shift()!.reject(new Error(message));
    await settle();
  }
}

/** Lets pending promises and zero-length timers finish. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

function setup() {
  const game = new Game();
  const engine = new FakeEngine();
  // "challenger" never plays random moves, so the tests are predictable.
  const opponent = new ComputerOpponent(game, engine, getLevel("challenger"), { thinkDelayMs: 0 });
  return { game, engine, opponent };
}

describe("ComputerOpponent", () => {
  it("does nothing until it is given a side", () => {
    const { game, engine } = setup();
    game.attemptMove("e2", "e4");
    expect(engine.requests).toHaveLength(0);
  });

  it("replies after the player moves", async () => {
    const { game, engine, opponent } = setup();
    opponent.setComputerColor("black");
    expect(engine.requests).toHaveLength(0); // white (the player) moves first

    game.attemptMove("e2", "e4");
    expect(opponent.isThinking()).toBe(true);
    expect(engine.requests[0]).toMatchObject({ fen: game.getPosition().fen, depth: 6, skillLevel: 6 });

    await engine.reply({ from: "e7", to: "e5" });
    expect(game.getPosition().lastMove).toMatchObject({ san: "e5", color: "black" });
    expect(opponent.isThinking()).toBe(false);
  });

  it("moves first when it plays white", async () => {
    const { game, engine, opponent } = setup();
    opponent.setComputerColor("white");
    await engine.reply({ from: "d2", to: "d4" });
    expect(game.getPosition().history.map((move) => move.san)).toEqual(["d4"]);
  });

  it("promotes when the engine says so", async () => {
    const game = new Game("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    const engine = new FakeEngine();
    const opponent = new ComputerOpponent(game, engine, getLevel("challenger"), { thinkDelayMs: 0 });
    opponent.setComputerColor("white");
    await engine.reply({ from: "a7", to: "a8", promotion: "queen" });
    expect(game.getPosition().pieces["a8"]).toEqual({ type: "queen", color: "white" });
  });

  it("ignores an answer that arrives after a new game", async () => {
    const { game, engine, opponent } = setup();
    opponent.setComputerColor("black");
    game.attemptMove("e2", "e4");
    game.newGame();

    await engine.reply({ from: "e7", to: "e5" });
    expect(game.getPosition().history).toEqual([]);
    expect(opponent.isThinking()).toBe(false);
  });

  it("stops when the game is over", async () => {
    const { game, engine, opponent } = setup();
    opponent.setComputerColor("black");
    game.attemptMove("f2", "f3");
    await engine.reply({ from: "e7", to: "e5" });
    game.attemptMove("g2", "g4");
    await engine.reply({ from: "d8", to: "h4" }); // checkmate

    expect(game.getPosition().status).toBe("checkmate");
    expect(opponent.isThinking()).toBe(false);
    expect(engine.requests).toHaveLength(2);
  });

  it("uses a new level from its next move", async () => {
    const { game, engine, opponent } = setup();
    opponent.setComputerColor("black");
    opponent.setLevel(getLevel("beginner"));
    game.attemptMove("e2", "e4");
    expect(engine.requests[0]).toMatchObject({ depth: 1, skillLevel: 0 });
  });

  it("reports thinking on and off to listeners", async () => {
    const { game, engine, opponent } = setup();
    const listener = vi.fn();
    opponent.onThinkingChanged(listener);
    opponent.setComputerColor("black");

    game.attemptMove("e2", "e4");
    await engine.reply({ from: "e7", to: "e5" });
    expect(listener.mock.calls.map((call) => call[0])).toEqual([true, false]);
  });

  it("reports an engine failure instead of hanging", async () => {
    const { game, engine, opponent } = setup();
    const onError = vi.fn();
    opponent.onError(onError);
    opponent.setComputerColor("black");

    game.attemptMove("e2", "e4");
    await engine.fail("engine crashed");

    expect(onError).toHaveBeenCalledOnce();
    expect(opponent.isThinking()).toBe(false);
  });
});

describe("undoTurn", () => {
  it("takes back the player's move and the computer's reply together", async () => {
    const { game, engine, opponent } = setup();
    opponent.setComputerColor("black");
    game.attemptMove("e2", "e4");
    await engine.reply({ from: "e7", to: "e5" });

    expect(opponent.undoTurn()).toBe(true);
    expect(game.getPosition().history).toEqual([]);
    expect(game.getPosition().turn).toBe("white");
    // It is the player's turn, so the computer must not start thinking.
    expect(opponent.isThinking()).toBe(false);
    expect(engine.requests).toHaveLength(1);
  });

  it("takes back only the player's move while the computer is still thinking", async () => {
    const { game, engine, opponent } = setup();
    opponent.setComputerColor("black");
    game.attemptMove("e2", "e4");

    opponent.undoTurn();
    expect(game.getPosition().history).toEqual([]);
    expect(opponent.isThinking()).toBe(false);

    // The late answer for the undone position is thrown away.
    await engine.reply({ from: "e7", to: "e5" });
    expect(game.getPosition().history).toEqual([]);
  });

  it("undoes one move at a time when two people are playing", () => {
    const { game, opponent } = setup();
    game.attemptMove("e2", "e4");
    game.attemptMove("e7", "e5");
    opponent.undoTurn();
    expect(game.getPosition().history).toHaveLength(1);
  });

  it("returns false when there is nothing to undo", () => {
    expect(setup().opponent.undoTurn()).toBe(false);
  });
});
