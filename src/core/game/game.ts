import { Chess } from "chess.js";
import type { Move, PieceSymbol, Square as ChessJsSquare } from "chess.js";
import { isSquare } from "../types";
import type {
  Color,
  DrawReason,
  GameInput,
  GameStatus,
  MoveRecord,
  MoveResult,
  Piece,
  PieceType,
  Position,
  PositionListener,
  PromotionPiece,
  Square,
} from "../types";

// chess.js uses one-letter codes. The rest of the app uses full words,
// so the translation happens here and nowhere else.
const PIECE_NAMES: Record<PieceSymbol, PieceType> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const PROMOTION_CODES: Record<PromotionPiece, PieceSymbol> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};

function toColor(code: "w" | "b"): Color {
  return code === "w" ? "white" : "black";
}

function toMoveRecord(move: Move): MoveRecord {
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
  };
}

/**
 * One game of chess. chess.js knows the rules; this class wraps it in the
 * small interface the rest of the app uses and announces every change.
 */
export class Game implements GameInput {
  private chess: Chess;
  private listeners = new Set<PositionListener>();

  /** Starts from the normal starting position, or from `fen` if given. */
  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  attemptMove(from: Square, to: Square, promotion?: PromotionPiece): MoveResult {
    if (this.chess.isGameOver()) return { ok: false, reason: "game-over" };
    if (!isSquare(from) || !isSquare(to)) return { ok: false, reason: "invalid-square" };

    const piece = this.chess.get(from as ChessJsSquare);
    if (!piece) return { ok: false, reason: "no-piece" };
    if (piece.color !== this.chess.turn()) return { ok: false, reason: "not-your-turn" };

    // A promotion shows up as four legal moves (one per piece), so there
    // can be several candidates for the same from/to pair.
    const candidates = this.legalMoves(from).filter((move) => move.to === to);
    if (candidates.length === 0) return { ok: false, reason: "illegal" };

    if (candidates[0].isPromotion() && !promotion) {
      return { ok: false, reason: "needs-promotion" };
    }

    const played = this.chess.move({
      from,
      to,
      promotion: promotion ? PROMOTION_CODES[promotion] : undefined,
    });
    this.notify();
    return { ok: true, move: toMoveRecord(played) };
  }

  legalMovesFrom(from: Square): Square[] {
    if (!isSquare(from)) return [];
    const destinations = this.legalMoves(from).map((move) => move.to);
    return [...new Set(destinations)];
  }

  isPromotionMove(from: Square, to: Square): boolean {
    if (!isSquare(from) || !isSquare(to)) return false;
    return this.legalMoves(from).some((move) => move.to === to && move.isPromotion());
  }

  /** Takes back the last move. Returns false if there is nothing to undo. */
  undo(): boolean {
    const undone = this.chess.undo();
    if (!undone) return false;
    this.notify();
    return true;
  }

  /** Throws away the current game and starts a new one. */
  newGame(fen?: string): void {
    this.chess = new Chess(fen);
    this.notify();
  }

  getPosition(): Position {
    const pieces: Record<Square, Piece> = {};
    for (const row of this.chess.board()) {
      for (const cell of row) {
        if (cell) pieces[cell.square] = { type: PIECE_NAMES[cell.type], color: toColor(cell.color) };
      }
    }

    const history = this.chess.history({ verbose: true }).map(toMoveRecord);
    const status = this.status();
    const turn = toColor(this.chess.turn());

    return {
      fen: this.chess.fen(),
      turn,
      pieces,
      inCheck: this.chess.inCheck(),
      status,
      // In checkmate the side to move is the one that lost.
      winner: status === "checkmate" ? (turn === "white" ? "black" : "white") : undefined,
      drawReason: status === "draw" ? this.drawReason() : undefined,
      history,
      lastMove: history[history.length - 1],
    };
  }

  onPositionChanged(listener: PositionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private legalMoves(from: Square): Move[] {
    return this.chess.moves({ square: from as ChessJsSquare, verbose: true });
  }

  private status(): GameStatus {
    if (this.chess.isCheckmate()) return "checkmate";
    if (this.chess.isStalemate()) return "stalemate";
    if (this.chess.isDraw()) return "draw";
    return "playing";
  }

  private drawReason(): DrawReason {
    if (this.chess.isInsufficientMaterial()) return "insufficient-material";
    if (this.chess.isThreefoldRepetition()) return "threefold-repetition";
    return "fifty-move-rule";
  }

  private notify(): void {
    const position = this.getPosition();
    for (const listener of this.listeners) listener(position);
  }
}
