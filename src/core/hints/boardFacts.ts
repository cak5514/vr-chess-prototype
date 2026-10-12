import { Chess, SQUARES } from "chess.js";
import type { Color as ChessJsColor, Move, Square as ChessJsSquare } from "chess.js";
import { PIECE_VALUES } from "../analysis/threats";
import { passTurn, PIECE_NAMES } from "../game/chessJsHelpers";
import type { PieceType, Square } from "../types";

// Small questions we can ask about a position. The hint rules are built
// from these, so each rule stays one or two readable lines.

export { passTurn, PIECE_NAMES };

/** Every square the piece on `square` attacks or defends, in a-to-h order. */
export function attackedSquaresFrom(chess: Chess, square: Square): Square[] {
  const piece = chess.get(square as ChessJsSquare);
  if (!piece) return [];
  return SQUARES.filter(
    (target) => target !== square && chess.attackers(target, piece.color).includes(square as ChessJsSquare),
  ).sort();
}

/** A move that gives checkmate immediately, if the side to move has one. */
export function findMateInOne(fen: string): Move | null {
  const chess = new Chess(fen, { skipValidation: true });
  for (const move of chess.moves({ verbose: true })) {
    chess.move(move);
    const isMate = chess.isCheckmate();
    chess.undo();
    if (isMate) return move;
  }
  return null;
}

/** Total value of one side's pieces, in pawns. The king is not counted. */
export function materialOf(chess: Chess, color: ChessJsColor): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.color === color && cell.type !== "k") total += PIECE_VALUES[PIECE_NAMES[cell.type]];
    }
  }
  return total;
}

/**
 * - "open": no pawns on the file at all.
 * - "half-open": none of `color`'s own pawns, but an enemy pawn.
 * - "closed": one of `color`'s own pawns is in the way.
 */
export function fileKind(chess: Chess, file: string, color: ChessJsColor): "open" | "half-open" | "closed" {
  let enemyPawn = false;
  for (let rank = 1; rank <= 8; rank++) {
    const piece = chess.get(`${file}${rank}` as ChessJsSquare);
    if (piece?.type !== "p") continue;
    if (piece.color === color) return "closed";
    enemyPawn = true;
  }
  return enemyPawn ? "half-open" : "open";
}

/** True if no enemy pawn can ever block or capture the pawn on `square`. */
export function isPassedPawn(chess: Chess, square: Square): boolean {
  const pawn = chess.get(square as ChessJsSquare);
  if (pawn?.type !== "p") return false;

  const file = square.charCodeAt(0);
  const rank = Number(square[1]);
  const step = pawn.color === "w" ? 1 : -1;

  // Look at every square ahead of the pawn on its own file and the two beside it.
  for (let r = rank + step; r >= 1 && r <= 8; r += step) {
    for (const f of [file - 1, file, file + 1]) {
      if (f < 97 || f > 104) continue; // off the board ("a" is 97, "h" is 104)
      const piece = chess.get(`${String.fromCharCode(f)}${r}` as ChessJsSquare);
      if (piece?.type === "p" && piece.color !== pawn.color) return false;
    }
  }
  return true;
}

/** Says a move in words instead of notation: "queen takes the pawn on f7". */
export function moveInWords(move: Move): string {
  if (move.isKingsideCastle() || move.isQueensideCastle()) return "castling";
  const piece = PIECE_NAMES[move.piece];
  if (move.captured) return `${piece} takes the ${PIECE_NAMES[move.captured]} on ${move.to}`;
  return `${piece} to ${move.to}`;
}

/** Joins words naturally: "d4", "d4 and e5", "c5, d4 and e5". */
export function listInWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function valueOf(piece: PieceType): number {
  return PIECE_VALUES[piece];
}
