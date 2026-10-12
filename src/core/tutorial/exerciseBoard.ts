import { Chess } from "chess.js";
import type { Move, Square as ChessJsSquare } from "chess.js";
import { passTurn, PIECE_NAMES, PROMOTION_CODES, toColor, toMoveRecord } from "../game/chessJsHelpers";
import { isSquare } from "../types";
import type {
  GameInput,
  MoveRecord,
  MoveResult,
  Piece,
  Position,
  PositionListener,
  PromotionPiece,
  Square,
} from "../types";

const EMPTY_BOARD = "8/8/8/8/8/8/8/8 w - - 0 1";

/**
 * A practice board for tutorial exercises.
 *
 * It follows the same GameInput interface as a real game, so the same board
 * view and the same click-to-move logic work on it. It differs from a real
 * game in two ways:
 * - a position may hold just one or two pieces, with no kings at all;
 * - only white moves. After each move the turn comes straight back, so the
 *   learner can make several moves in a row.
 */
export class ExerciseBoard implements GameInput {
  private chess = new Chess(EMPTY_BOARD, { skipValidation: true });
  private listeners = new Set<PositionListener>();
  private lastMove: MoveRecord | undefined;

  /** How many moves the learner has made since the position was loaded. */
  movesPlayed = 0;
  /** When true the pieces cannot be moved (reading steps, or after solving). */
  locked = false;

  /** Sets up a new position and forgets everything about the old one. */
  load(fen: string): void {
    // Tutorial positions are deliberately unusual, so chess.js must not reject them.
    this.chess = new Chess(fen, { skipValidation: true });
    this.lastMove = undefined;
    this.movesPlayed = 0;
    this.notify();
  }

  attemptMove(from: Square, to: Square, promotion?: PromotionPiece): MoveResult {
    if (this.locked) return { ok: false, reason: "game-over" };
    if (!isSquare(from) || !isSquare(to)) return { ok: false, reason: "invalid-square" };

    const piece = this.chess.get(from as ChessJsSquare);
    if (!piece) return { ok: false, reason: "no-piece" };
    if (piece.color !== "w") return { ok: false, reason: "not-your-turn" };

    const candidates = this.legalMoves(from).filter((move) => move.to === to);
    if (candidates.length === 0) return { ok: false, reason: "illegal" };
    if (candidates[0].isPromotion() && !promotion) return { ok: false, reason: "needs-promotion" };

    const played = this.chess.move({
      from,
      to,
      promotion: promotion ? PROMOTION_CODES[promotion] : undefined,
    });
    this.lastMove = toMoveRecord(played);
    this.movesPlayed++;
    // Hand the turn straight back to white.
    this.chess = new Chess(passTurn(this.chess.fen()), { skipValidation: true });
    this.notify();
    return { ok: true, move: this.lastMove };
  }

  legalMovesFrom(from: Square): Square[] {
    if (this.locked || !isSquare(from)) return [];
    return this.reachableFrom(from);
  }

  /** Where a piece could go, even while the board is locked. Used to show how a piece moves. */
  reachableFrom(from: Square): Square[] {
    if (!isSquare(from)) return [];
    return [...new Set(this.legalMoves(from).map((move) => move.to as Square))];
  }

  isPromotionMove(from: Square, to: Square): boolean {
    if (!isSquare(from) || !isSquare(to)) return false;
    return this.legalMoves(from).some((move) => move.to === to && move.isPromotion());
  }

  getPosition(): Position {
    const pieces: Record<Square, Piece> = {};
    for (const row of this.chess.board()) {
      for (const cell of row) {
        if (cell) pieces[cell.square] = { type: PIECE_NAMES[cell.type], color: toColor(cell.color) };
      }
    }
    return {
      fen: this.chess.fen(),
      turn: "white",
      pieces,
      inCheck: this.chess.inCheck(),
      // An exercise is never "over" the way a game is; the lesson decides when it is solved.
      status: "playing",
      history: [],
      lastMove: this.lastMove,
    };
  }

  onPositionChanged(listener: PositionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private legalMoves(from: Square): Move[] {
    return this.chess.moves({ square: from as ChessJsSquare, verbose: true });
  }

  private notify(): void {
    const position = this.getPosition();
    for (const listener of this.listeners) listener(position);
  }
}
