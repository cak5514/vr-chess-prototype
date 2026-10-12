import { Chess } from "chess.js";
import type { Move, Square as ChessJsSquare } from "chess.js";
import { passTurn, PIECE_NAMES, PROMOTION_CODES, toColor, toMoveRecord } from "../game/chessJsHelpers";
import { isSquare } from "../types";
import type {
  Color,
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
 * - only the learner moves. After each move the turn comes straight back,
 *   so the learner can make several moves in a row.
 *
 * The learner plays whichever side is to move in the position that is loaded.
 */
export class ExerciseBoard implements GameInput {
  private chess = new Chess(EMPTY_BOARD, { skipValidation: true });
  private listeners = new Set<PositionListener>();
  private lastMove: MoveRecord | undefined;
  private learner: "w" | "b" = "w";

  /** How many moves the learner has made since the position was loaded. */
  movesPlayed = 0;
  /** When true the pieces cannot be moved (reading steps, or after solving). */
  locked = false;

  /**
   * Sets up a new position and forgets everything about the old one.
   * `shownMove` highlights a move on the board, used to show the reply the
   * opponent has just made in a lesson.
   */
  load(fen: string, shownMove?: { from: Square; to: Square }): void {
    // Tutorial positions are deliberately unusual, so chess.js must not reject them.
    this.chess = new Chess(fen, { skipValidation: true });
    this.learner = this.chess.turn();
    this.movesPlayed = 0;
    // The board view only needs the two squares, so the rest is left blank.
    this.lastMove = shownMove
      ? {
          from: shownMove.from,
          to: shownMove.to,
          color: toColor(this.learner === "w" ? "b" : "w"),
          piece: "pawn",
          san: "",
          isCastle: false,
          isEnPassant: false,
          fenBefore: fen,
          fenAfter: fen,
        }
      : undefined;
    this.notify();
  }

  /** The side the learner plays in the loaded position. */
  learnerColor(): Color {
    return toColor(this.learner);
  }

  attemptMove(from: Square, to: Square, promotion?: PromotionPiece): MoveResult {
    if (this.locked) return { ok: false, reason: "game-over" };
    if (!isSquare(from) || !isSquare(to)) return { ok: false, reason: "invalid-square" };

    const piece = this.chess.get(from as ChessJsSquare);
    if (!piece) return { ok: false, reason: "no-piece" };
    if (piece.color !== this.learner) return { ok: false, reason: "not-your-turn" };

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
    // Hand the turn straight back to the learner.
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
      turn: toColor(this.learner),
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
