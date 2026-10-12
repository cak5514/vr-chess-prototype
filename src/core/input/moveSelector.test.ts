import { describe, expect, it, vi } from "vitest";
import { Game } from "../game/game";
import { MoveSelector } from "./moveSelector";

function setup(fen?: string) {
  const game = new Game(fen);
  const selector = new MoveSelector(game);
  return { game, selector };
}

describe("picking squares", () => {
  it("selects a piece and shows where it can go", () => {
    const { selector } = setup();
    selector.pick("e2");
    expect(selector.getState().selected).toBe("e2");
    expect(selector.getState().targets.sort()).toEqual(["e3", "e4"]);
  });

  it("moves when a highlighted square is picked", () => {
    const { game, selector } = setup();
    selector.pick("e2");
    selector.pick("e4");
    expect(game.getPosition().pieces["e4"]).toEqual({ type: "pawn", color: "white" });
    expect(selector.getState().selected).toBeNull();
  });

  it("puts the piece down when it is picked again", () => {
    const { selector } = setup();
    selector.pick("e2");
    selector.pick("e2");
    expect(selector.getState().selected).toBeNull();
  });

  it("switches to another of the player's pieces", () => {
    const { selector } = setup();
    selector.pick("e2");
    selector.pick("g1");
    expect(selector.getState().selected).toBe("g1");
  });

  it("clears the selection when a square it cannot reach is picked", () => {
    const { game, selector } = setup();
    selector.pick("e2");
    selector.pick("e5");
    expect(selector.getState().selected).toBeNull();
    expect(game.getPosition().history).toEqual([]);
  });

  it("does not select empty squares or the opponent's pieces", () => {
    const { selector } = setup();
    selector.pick("e4");
    expect(selector.getState().selected).toBeNull();
    selector.pick("e7");
    expect(selector.getState().selected).toBeNull();
  });

  it("captures when the picked square holds an enemy piece it can take", () => {
    const { game, selector } = setup();
    game.attemptMove("e2", "e4");
    game.attemptMove("d7", "d5");
    selector.pick("e4");
    selector.pick("d5");
    expect(game.getPosition().lastMove).toMatchObject({ san: "exd5", captured: "pawn" });
  });
});

describe("dragging", () => {
  it("moves on a legal drop", () => {
    const { game, selector } = setup();
    selector.drop("g1", "f3");
    expect(game.getPosition().pieces["f3"]).toEqual({ type: "knight", color: "white" });
  });

  it("ignores an illegal drop and keeps the piece selected", () => {
    const { game, selector } = setup();
    selector.pick("g1");
    selector.drop("g1", "g3");
    expect(game.getPosition().history).toEqual([]);
    expect(selector.getState().selected).toBe("g1");
  });

  it("ignores dragging the opponent's piece", () => {
    const { game, selector } = setup();
    selector.drop("e7", "e5");
    expect(game.getPosition().history).toEqual([]);
  });
});

describe("promotion", () => {
  const PAWN_ABOUT_TO_PROMOTE = "8/P6k/8/8/8/8/8/K7 w - - 0 1";

  it("waits for the player to choose a piece", () => {
    const { game, selector } = setup(PAWN_ABOUT_TO_PROMOTE);
    selector.pick("a7");
    selector.pick("a8");

    expect(selector.getState().pendingPromotion).toEqual({ from: "a7", to: "a8" });
    expect(game.getPosition().history).toEqual([]);

    // Other clicks are ignored until the choice is made.
    selector.pick("a1");
    expect(selector.getState().pendingPromotion).not.toBeNull();

    selector.choosePromotion("rook");
    expect(game.getPosition().pieces["a8"]).toEqual({ type: "rook", color: "white" });
    expect(selector.getState().pendingPromotion).toBeNull();
  });

  it("can be cancelled without moving", () => {
    const { game, selector } = setup(PAWN_ABOUT_TO_PROMOTE);
    selector.drop("a7", "a8");
    selector.cancelPromotion();
    expect(selector.getState()).toMatchObject({ selected: null, pendingPromotion: null });
    expect(game.getPosition().history).toEqual([]);
  });
});

describe("limits", () => {
  it("only lets the player move the colours they control", () => {
    const { game, selector } = setup();
    selector.setMovableColors(["white"]);
    game.attemptMove("e2", "e4");

    selector.pick("e7"); // black's turn, but black belongs to the computer
    expect(selector.getState().selected).toBeNull();
    selector.drop("e7", "e5");
    expect(game.getPosition().history).toHaveLength(1);
  });

  it("selects nothing once the game is over", () => {
    // Fool's mate: white is checkmated.
    const { game, selector } = setup();
    for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
      game.attemptMove(from, to);
    }
    selector.pick("e2");
    expect(selector.getState().selected).toBeNull();
  });
});

describe("staying in sync", () => {
  it("drops the selection after undo and new game", () => {
    const { game, selector } = setup();
    game.attemptMove("e2", "e4");
    selector.pick("e7");
    game.undo();
    expect(selector.getState().selected).toBeNull();

    selector.pick("d2");
    game.newGame();
    expect(selector.getState().selected).toBeNull();
  });

  it("tells listeners when the selection changes", () => {
    const { selector } = setup();
    const listener = vi.fn();
    const unsubscribe = selector.onChange(listener);

    selector.pick("e2");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    selector.pick("e2");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
