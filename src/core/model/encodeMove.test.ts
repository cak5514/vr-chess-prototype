import { describe, expect, it } from "vitest";
import { ENCODED_LENGTH, encodeMove, PLANE_SIZE } from "./encodeMove";
import parityCases from "./parityCases.json";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

/** Reads one square from one plane. Row 0 is the mover's own back rank. */
function at(encoded: Uint8Array, plane: number, row: number, column: number): number {
  return encoded[plane * PLANE_SIZE + row * 8 + column];
}

/** How many 1s a plane contains. */
function count(encoded: Uint8Array, plane: number): number {
  let total = 0;
  for (let i = 0; i < PLANE_SIZE; i++) total += encoded[plane * PLANE_SIZE + i];
  return total;
}

// These cases were written by training/export.py. Each one records what the
// Python encoder produced for a position and move. If this test fails, the
// two encoders have drifted apart and the model would be fed scrambled boards.
describe("encodeMove matches the Python encoder used in training", () => {
  it.each(parityCases)("$move in $fen", ({ fen, move, planes }) => {
    const promotions = { q: "queen", r: "rook", b: "bishop", n: "knight" } as const;
    const encoded = encodeMove(fen, {
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] ? promotions[move[4] as keyof typeof promotions] : undefined,
    });
    expect(encoded).not.toBeNull();
    expect([...encoded!].join("")).toBe(planes);
  });

  it("covers both colours and the special moves", () => {
    expect(parityCases.length).toBeGreaterThanOrEqual(8);
  });
});

describe("encodeMove", () => {
  it("produces 26 planes of 64 squares, holding only 0s and 1s", () => {
    const encoded = encodeMove(START, { from: "g1", to: "f3" })!;
    expect(encoded).toHaveLength(ENCODED_LENGTH);
    expect(ENCODED_LENGTH).toBe(1664);
    expect([...encoded].every((value) => value === 0 || value === 1)).toBe(true);
  });

  it("counts the pieces of each side before the move", () => {
    const encoded = encodeMove(START, { from: "g1", to: "f3" })!;
    // Planes 0-5 are the mover's pawn, knight, bishop, rook, queen, king.
    expect([0, 1, 2, 3, 4, 5].map((plane) => count(encoded, plane))).toEqual([8, 2, 2, 2, 1, 1]);
    // Planes 6-11 are the opponent's.
    expect([6, 7, 8, 9, 10, 11].map((plane) => count(encoded, plane))).toEqual([8, 2, 2, 2, 1, 1]);
  });

  it("marks where the move starts and ends", () => {
    const encoded = encodeMove(START, { from: "g1", to: "f3" })!;
    expect(count(encoded, 12)).toBe(1);
    expect(count(encoded, 13)).toBe(1);
    expect(at(encoded, 12, 0, 6)).toBe(1); // g1: row 0, column g
    expect(at(encoded, 13, 2, 5)).toBe(1); // f3: row 2, column f
  });

  it("shows the board after the move in the later planes", () => {
    const encoded = encodeMove(START, { from: "g1", to: "f3" })!;
    // Before: a knight on g1. After: that knight is on f3 instead.
    expect(at(encoded, 1, 0, 6)).toBe(1);
    expect(at(encoded, 15, 0, 6)).toBe(0);
    expect(at(encoded, 15, 2, 5)).toBe(1);
  });

  it("flips the board for black, so the mover always plays upwards", () => {
    const encoded = encodeMove(AFTER_E4, { from: "g8", to: "f6" })!;
    // Black's knight on g8 appears on the mover's own back rank (row 0).
    expect(at(encoded, 1, 0, 6)).toBe(1);
    expect(at(encoded, 12, 0, 6)).toBe(1);
    expect(at(encoded, 13, 2, 5)).toBe(1); // f6 is two rows up from black's side
    // White's pawn on e4 is the opponent's, seen from black's side: row 4.
    expect(at(encoded, 6, 4, 4)).toBe(1);
  });

  it("removes a captured piece from the board after the move", () => {
    // White pawn on e4 takes the black pawn on d5.
    const fen = "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1";
    const encoded = encodeMove(fen, { from: "e4", to: "d5" })!;
    expect(count(encoded, 6)).toBe(1); // one enemy pawn before
    expect(count(encoded, 20)).toBe(0); // none after
  });

  it("turns a promoted pawn into the new piece", () => {
    const fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
    const encoded = encodeMove(fen, { from: "a7", to: "a8", promotion: "queen" })!;
    expect(count(encoded, 0)).toBe(1); // a pawn before
    expect(count(encoded, 14)).toBe(0); // no pawn after
    expect(at(encoded, 18, 7, 0)).toBe(1); // a queen on a8 after
  });

  it("returns null for an illegal move", () => {
    expect(encodeMove(START, { from: "e2", to: "e5" })).toBeNull();
  });
});
