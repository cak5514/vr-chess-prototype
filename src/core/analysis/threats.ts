import { Chess } from "chess.js";
import type { Color as ChessJsColor, Square as ChessJsSquare } from "chess.js";
import { PIECE_NAMES } from "../game/chessJsHelpers";
import type { Color, PieceType, Square } from "../types";

/** What a piece is roughly worth, in pawns. The usual beginner's scale. */
export const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  // The king cannot be captured, so it never counts as "worth less".
  king: 100,
};

/**
 * - "hanging": the piece is attacked and nothing defends it, so it can be
 *   taken for free.
 * - "attacked-by-weaker": it is defended, but the attacker is worth less,
 *   so the trade still loses material (e.g. a pawn attacking a queen).
 */
export type ThreatKind = "hanging" | "attacked-by-weaker";

export interface Threat {
  square: Square;
  piece: PieceType;
  kind: ThreatKind;
  /** The least valuable enemy piece attacking it. */
  attacker: PieceType;
  attackerSquare: Square;
}

/**
 * Finds the pieces of `color` that are in danger in this position.
 * The most valuable piece comes first.
 *
 * This is a simple count of attackers and defenders. It does not look
 * ahead, so it can miss deeper tactics, but it catches the mistakes
 * beginners make most often.
 */
export function findThreatenedPieces(fen: string, color: Color): Threat[] {
  const chess = new Chess(fen, { skipValidation: true });
  const mine: ChessJsColor = color === "white" ? "w" : "b";
  const theirs: ChessJsColor = color === "white" ? "b" : "w";
  const threats: Threat[] = [];

  for (const row of chess.board()) {
    for (const cell of row) {
      // Attacks on the king are "check", which is reported separately.
      if (!cell || cell.color !== mine || cell.type === "k") continue;

      const attackers = chess.attackers(cell.square, theirs);
      if (attackers.length === 0) continue;

      const piece = PIECE_NAMES[cell.type];
      const weakest = weakestPiece(chess, attackers);
      const isDefended = chess.attackers(cell.square, mine).length > 0;

      let kind: ThreatKind | null = null;
      if (!isDefended) kind = "hanging";
      else if (PIECE_VALUES[weakest.piece] < PIECE_VALUES[piece]) kind = "attacked-by-weaker";

      if (kind) {
        threats.push({
          square: cell.square,
          piece,
          kind,
          attacker: weakest.piece,
          attackerSquare: weakest.square,
        });
      }
    }
  }

  return threats.sort((a, b) => PIECE_VALUES[b.piece] - PIECE_VALUES[a.piece]);
}

function weakestPiece(chess: Chess, squares: ChessJsSquare[]): { piece: PieceType; square: Square } {
  let best = { piece: PIECE_NAMES[chess.get(squares[0])!.type], square: squares[0] as Square };
  for (const square of squares) {
    const piece = PIECE_NAMES[chess.get(square)!.type];
    if (PIECE_VALUES[piece] < PIECE_VALUES[best.piece]) best = { piece, square };
  }
  return best;
}

/** Turns a threat into one plain sentence for the player. */
export function describeThreat(threat: Threat): string {
  const target = `Your ${threat.piece} on ${threat.square}`;
  const attacker = `the ${threat.attacker} on ${threat.attackerSquare}`;
  if (threat.kind === "hanging") {
    return `${target} is attacked by ${attacker} and nothing defends it.`;
  }
  return `${target} is attacked by ${attacker}, which is worth less.`;
}
