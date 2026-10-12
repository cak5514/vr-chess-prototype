import { Chess } from "chess.js";
import { PROMOTION_CODES } from "../game/chessJsHelpers";
import type { MoveChoice } from "../types";

// Turns a position plus one move into the numbers the neural network reads.
//
// The board is described as 26 grids of 8x8 squares, called planes. Each
// plane answers one yes/no question for every square (1 = yes):
//    0- 5  my pieces BEFORE the move   (pawn, knight, bishop, rook, queen, king)
//    6-11  the opponent's pieces BEFORE the move
//   12     the square the move starts from
//   13     the square the move lands on
//   14-19  my pieces AFTER the move
//   20-25  the opponent's pieces AFTER the move
//
// "My" means the side making the move. When black moves, the board is
// flipped top to bottom so the model always sees the mover playing upwards.
//
// IMPORTANT: this must match training/encode.py exactly. The model was
// trained on boards encoded by that file; if the two differ, the model is
// shown boards it has never seen. encodeMove.test.ts checks they agree.

export const NUM_PLANES = 26;
export const PLANE_SIZE = 64;
export const ENCODED_LENGTH = NUM_PLANES * PLANE_SIZE;

const PIECE_ORDER = ["p", "n", "b", "r", "q", "k"];

function writePieces(chess: Chess, mover: "w" | "b", firstPlane: number, out: Uint8Array): void {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const plane = firstPlane + PIECE_ORDER.indexOf(cell.type) + (cell.color === mover ? 0 : 6);
      out[plane * PLANE_SIZE + squareOffset(cell.square, mover)] = 1;
    }
  }
}

/** Where a square sits inside one plane: row * 8 + column, seen from the mover's side. */
function squareOffset(square: string, mover: "w" | "b"): number {
  const column = square.charCodeAt(0) - 97; // "a" is character 97
  const rank = Number(square[1]) - 1;
  const row = mover === "w" ? rank : 7 - rank;
  return row * 8 + column;
}

/**
 * Encodes `move` played in the position `fen`.
 * Returns null if the move is not legal there.
 */
export function encodeMove(fen: string, move: MoveChoice): Uint8Array | null {
  const chess = new Chess(fen);
  const mover = chess.turn();
  const out = new Uint8Array(ENCODED_LENGTH);

  writePieces(chess, mover, 0, out);
  out[12 * PLANE_SIZE + squareOffset(move.from, mover)] = 1;
  out[13 * PLANE_SIZE + squareOffset(move.to, mover)] = 1;

  try {
    chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion ? PROMOTION_CODES[move.promotion] : undefined,
    });
  } catch {
    return null;
  }
  writePieces(chess, mover, 14, out);
  return out;
}
