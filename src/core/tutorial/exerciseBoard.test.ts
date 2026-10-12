import { describe, expect, it, vi } from "vitest";
import { ExerciseBoard } from "./exerciseBoard";

const LONE_ROOK = "8/8/8/8/3R4/8/8/8 w - - 0 1";

function boardWith(fen: string): ExerciseBoard {
  const board = new ExerciseBoard();
  board.load(fen);
  return board;
}

describe("ExerciseBoard", () => {
  it("accepts a position with no kings", () => {
    const board = boardWith(LONE_ROOK);
    expect(board.getPosition().pieces).toEqual({ d4: { type: "rook", color: "white" } });
    expect(board.legalMovesFrom("d4")).toHaveLength(14);
  });

  it("lets white move several times in a row", () => {
    const board = boardWith(LONE_ROOK);
    expect(board.attemptMove("d4", "d8")).toMatchObject({ ok: true });
    expect(board.attemptMove("d8", "a8")).toMatchObject({ ok: true });
    expect(board.movesPlayed).toBe(2);
    expect(board.getPosition().pieces["a8"]).toEqual({ type: "rook", color: "white" });
    expect(board.getPosition().lastMove).toMatchObject({ from: "d8", to: "a8" });
  });

  it("refuses illegal moves and moving black's pieces", () => {
    const board = boardWith("8/8/8/8/3R2p1/8/8/8 w - - 0 1");
    expect(board.attemptMove("d4", "e5")).toEqual({ ok: false, reason: "illegal" });
    expect(board.attemptMove("g4", "g3")).toEqual({ ok: false, reason: "not-your-turn" });
    expect(board.attemptMove("a1", "a2")).toEqual({ ok: false, reason: "no-piece" });
    expect(board.movesPlayed).toBe(0);
  });

  it("follows the real rules for the king", () => {
    // The black rook controls the e-file, so the king cannot step onto it.
    const board = boardWith("4r3/8/8/8/8/8/3K4/8 w - - 0 1");
    const moves = board.legalMovesFrom("d2");
    expect(moves).toContain("c2");
    expect(moves).not.toContain("e2");
    expect(boardWith("4r3/8/8/8/8/8/8/4K3 w - - 0 1").getPosition().inCheck).toBe(true);
  });

  it("handles promotion, castling and en passant", () => {
    const promotion = boardWith("8/4P3/8/8/8/8/8/8 w - - 0 1");
    expect(promotion.isPromotionMove("e7", "e8")).toBe(true);
    expect(promotion.attemptMove("e7", "e8")).toEqual({ ok: false, reason: "needs-promotion" });
    expect(promotion.attemptMove("e7", "e8", "queen")).toMatchObject({ ok: true });

    const castling = boardWith("8/8/8/8/8/8/8/4K2R w K - 0 1");
    expect(castling.attemptMove("e1", "g1")).toMatchObject({ ok: true, move: { isCastle: true } });
    expect(castling.getPosition().pieces["f1"]).toEqual({ type: "rook", color: "white" });

    const enPassant = boardWith("8/8/8/3pP3/8/8/8/8 w - d6 0 1");
    expect(enPassant.attemptMove("e5", "d6")).toMatchObject({ ok: true, move: { isEnPassant: true } });
    expect(enPassant.getPosition().pieces["d5"]).toBeUndefined();
  });

  it("does not move while locked, but can still show where a piece could go", () => {
    const board = boardWith(LONE_ROOK);
    board.locked = true;
    expect(board.legalMovesFrom("d4")).toEqual([]);
    expect(board.attemptMove("d4", "d8")).toEqual({ ok: false, reason: "game-over" });
    expect(board.reachableFrom("d4")).toHaveLength(14);
  });

  it("starts fresh when a new position is loaded", () => {
    const board = boardWith(LONE_ROOK);
    board.attemptMove("d4", "d8");
    board.load(LONE_ROOK);
    expect(board.movesPlayed).toBe(0);
    expect(board.getPosition().lastMove).toBeUndefined();
  });

  it("tells listeners about loads and moves", () => {
    const board = new ExerciseBoard();
    const listener = vi.fn();
    board.onPositionChanged(listener);
    board.load(LONE_ROOK);
    board.attemptMove("d4", "d8");
    board.attemptMove("d8", "e7"); // refused
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
