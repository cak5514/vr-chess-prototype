import type { PieceType } from "../../core/index";

// The solid chess symbols from Unicode. Both colours use the same shapes
// and CSS paints them light or dark. The pawn carries a "text style" marker
// (︎) so phones do not swap it for a coloured emoji.
export const PIECE_GLYPHS: Record<PieceType, string> = {
  king: "♚",
  queen: "♛",
  rook: "♜",
  bishop: "♝",
  knight: "♞",
  pawn: "♟︎",
};
