import { describe, expect, it, vi } from "vitest";
import { Game } from "./game";

/** Plays a list of moves like ["e2", "e4"] and checks each one is accepted. */
function play(game: Game, moves: [string, string][]): void {
  for (const [from, to] of moves) {
    expect(game.attemptMove(from, to), `${from}-${to}`).toMatchObject({ ok: true });
  }
}

describe("a new game", () => {
  it("starts with 32 pieces and white to move", () => {
    const position = new Game().getPosition();
    expect(Object.keys(position.pieces)).toHaveLength(32);
    expect(position.turn).toBe("white");
    expect(position.status).toBe("playing");
    expect(position.history).toEqual([]);
    expect(position.pieces["e1"]).toEqual({ type: "king", color: "white" });
  });

  it("lists the legal moves of a piece", () => {
    const game = new Game();
    expect(game.legalMovesFrom("e2").sort()).toEqual(["e3", "e4"]);
    expect(game.legalMovesFrom("g1").sort()).toEqual(["f3", "h3"]);
    // The rook is blocked in at the start.
    expect(game.legalMovesFrom("a1")).toEqual([]);
    expect(game.legalMovesFrom("e4")).toEqual([]);
    expect(game.legalMovesFrom("z9")).toEqual([]);
  });
});

describe("attemptMove", () => {
  it("plays a legal move and records it", () => {
    const game = new Game();
    const result = game.attemptMove("e2", "e4");

    expect(result).toMatchObject({ ok: true, move: { piece: "pawn", color: "white", san: "e4" } });
    const position = game.getPosition();
    expect(position.pieces["e4"]).toEqual({ type: "pawn", color: "white" });
    expect(position.pieces["e2"]).toBeUndefined();
    expect(position.turn).toBe("black");
    expect(position.lastMove?.to).toBe("e4");
  });

  it("refuses bad moves and says why", () => {
    const game = new Game();
    expect(game.attemptMove("e2", "e5")).toEqual({ ok: false, reason: "illegal" });
    expect(game.attemptMove("e7", "e5")).toEqual({ ok: false, reason: "not-your-turn" });
    expect(game.attemptMove("e4", "e5")).toEqual({ ok: false, reason: "no-piece" });
    expect(game.attemptMove("e2", "e9")).toEqual({ ok: false, reason: "invalid-square" });
    // Nothing was played.
    expect(game.getPosition().history).toEqual([]);
  });

  it("does not allow a move that leaves the king in check", () => {
    // The white knight on e2 is pinned to its king by the rook on e8.
    const game = new Game("4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(game.legalMovesFrom("e2")).toEqual([]);
    expect(game.attemptMove("e2", "c3")).toEqual({ ok: false, reason: "illegal" });
  });
});

describe("check, checkmate and draws", () => {
  it("reports check", () => {
    const game = new Game();
    play(game, [["e2", "e4"], ["f7", "f6"], ["d1", "h5"]]);
    const position = game.getPosition();
    expect(position.inCheck).toBe(true);
    expect(position.status).toBe("playing");
  });

  it("detects checkmate and names the winner (scholar's mate)", () => {
    const game = new Game();
    play(game, [
      ["e2", "e4"], ["e7", "e5"],
      ["d1", "h5"], ["b8", "c6"],
      ["f1", "c4"], ["g8", "f6"],
      ["h5", "f7"],
    ]);
    const position = game.getPosition();
    expect(position.status).toBe("checkmate");
    expect(position.winner).toBe("white");
    expect(game.attemptMove("e8", "f7")).toEqual({ ok: false, reason: "game-over" });
  });

  it("names black as the winner when black gives mate (fool's mate)", () => {
    const game = new Game();
    play(game, [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
    expect(game.getPosition()).toMatchObject({ status: "checkmate", winner: "black" });
  });

  it("detects stalemate", () => {
    const position = new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").getPosition();
    expect(position.status).toBe("stalemate");
    expect(position.inCheck).toBe(false);
    expect(position.winner).toBeUndefined();
  });

  it("detects a draw when neither side can win", () => {
    const position = new Game("8/8/8/4k3/8/8/8/4K3 w - - 0 1").getPosition();
    expect(position).toMatchObject({ status: "draw", drawReason: "insufficient-material" });
  });
});

describe("special moves", () => {
  it("castles on both sides and moves the rook too", () => {
    const kingside = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(kingside.attemptMove("e1", "g1")).toMatchObject({ ok: true, move: { isCastle: true } });
    expect(kingside.getPosition().pieces["f1"]).toEqual({ type: "rook", color: "white" });
    expect(kingside.getPosition().pieces["h1"]).toBeUndefined();

    const queenside = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(queenside.attemptMove("e1", "c1")).toMatchObject({ ok: true, move: { isCastle: true } });
    expect(queenside.getPosition().pieces["d1"]).toEqual({ type: "rook", color: "white" });
  });

  it("does not allow castling through an attacked square", () => {
    // The black rook on f3 attacks f1, which the king would cross.
    const game = new Game("4k3/8/8/8/8/5r2/8/R3K2R w KQ - 0 1");
    const moves = game.legalMovesFrom("e1");
    expect(moves).not.toContain("g1");
    expect(moves).toContain("c1");
  });

  it("captures en passant and removes the passed pawn", () => {
    const game = new Game();
    play(game, [["e2", "e4"], ["a7", "a6"], ["e4", "e5"], ["d7", "d5"]]);

    const result = game.attemptMove("e5", "d6");
    expect(result).toMatchObject({ ok: true, move: { isEnPassant: true, captured: "pawn" } });
    const position = game.getPosition();
    expect(position.pieces["d5"]).toBeUndefined();
    expect(position.pieces["d6"]).toEqual({ type: "pawn", color: "white" });
  });

  it("asks for a promotion piece, then promotes", () => {
    const game = new Game("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    expect(game.isPromotionMove("a7", "a8")).toBe(true);
    expect(game.isPromotionMove("a1", "a2")).toBe(false);
    // Four promotion choices still count as one destination square.
    expect(game.legalMovesFrom("a7")).toEqual(["a8"]);

    expect(game.attemptMove("a7", "a8")).toEqual({ ok: false, reason: "needs-promotion" });
    expect(game.getPosition().pieces["a7"]).toBeDefined();

    expect(game.attemptMove("a7", "a8", "knight")).toMatchObject({
      ok: true,
      move: { promotion: "knight" },
    });
    expect(game.getPosition().pieces["a8"]).toEqual({ type: "knight", color: "white" });
  });
});

describe("undo and new game", () => {
  it("takes back the last move", () => {
    const game = new Game();
    const startFen = game.getPosition().fen;
    play(game, [["e2", "e4"]]);

    expect(game.undo()).toBe(true);
    expect(game.getPosition().fen).toBe(startFen);
    expect(game.getPosition().history).toEqual([]);
  });

  it("returns false when there is nothing to undo", () => {
    expect(new Game().undo()).toBe(false);
  });

  it("can undo out of checkmate and keep playing", () => {
    const game = new Game();
    play(game, [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
    game.undo();
    expect(game.getPosition().status).toBe("playing");
    expect(game.attemptMove("d7", "d6")).toMatchObject({ ok: true });
  });

  it("resets to the starting position", () => {
    const game = new Game();
    play(game, [["e2", "e4"], ["e7", "e5"]]);
    game.newGame();
    const position = game.getPosition();
    expect(position.history).toEqual([]);
    expect(position.turn).toBe("white");
    expect(Object.keys(position.pieces)).toHaveLength(32);
  });
});

describe("position events", () => {
  it("tells listeners about every change, but not about refused moves", () => {
    const game = new Game();
    const listener = vi.fn();
    game.onPositionChanged(listener);

    game.attemptMove("e2", "e4");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].turn).toBe("black");

    game.attemptMove("e2", "e4"); // refused: no piece there any more
    expect(listener).toHaveBeenCalledTimes(1);

    game.undo();
    game.newGame();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("stops calling a listener after it unsubscribes", () => {
    const game = new Game();
    const listener = vi.fn();
    const unsubscribe = game.onPositionChanged(listener);
    unsubscribe();
    game.attemptMove("e2", "e4");
    expect(listener).not.toHaveBeenCalled();
  });
});
