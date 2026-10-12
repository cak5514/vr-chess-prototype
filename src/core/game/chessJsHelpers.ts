import type { Move, PieceSymbol } from "chess.js";
import type { Color, MoveRecord, PieceType, PromotionPiece } from "../types";

// chess.js uses one-letter codes. The rest of the app uses full words, so
// the translation between the two lives here and nowhere else.

export const PIECE_NAMES: Record<PieceSymbol, PieceType> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export const PROMOTION_CODES: Record<PromotionPiece, PieceSymbol> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};

export function toColor(code: "w" | "b"): Color {
  return code === "w" ? "white" : "black";
}

export function toMoveRecord(move: Move): MoveRecord {
  return {
    from: move.from,
    to: move.to,
    color: toColor(move.color),
    piece: PIECE_NAMES[move.piece],
    captured: move.captured ? PIECE_NAMES[move.captured] : undefined,
    promotion: move.promotion ? (PIECE_NAMES[move.promotion] as PromotionPiece) : undefined,
    san: move.san,
    isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
    isEnPassant: move.isEnPassant(),
    fenBefore: move.before,
    fenAfter: move.after,
  };
}

/** The same position with the other side to move, as if a turn was skipped. */
export function passTurn(fen: string): string {
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-"; // the en passant chance is gone after a skipped turn
  return parts.join(" ");
}
