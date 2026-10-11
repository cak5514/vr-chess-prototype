// Shared types used by every part of core/.

/** A board square in algebraic notation, e.g. "e4". */
export type Square = string;

export type Color = "white" | "black";

export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

/** The pieces a pawn can turn into when it reaches the last rank. */
export type PromotionPiece = "queen" | "rook" | "bishop" | "knight";

export interface Piece {
  type: PieceType;
  color: Color;
}

/** One move that has been played, with everything the UI needs to show it. */
export interface MoveRecord {
  from: Square;
  to: Square;
  color: Color;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PromotionPiece;
  /** Standard notation for the move list, e.g. "Nf3" or "exd5". */
  san: string;
  isCastle: boolean;
  isEnPassant: boolean;
}

export type GameStatus = "playing" | "checkmate" | "stalemate" | "draw";

export type DrawReason = "insufficient-material" | "threefold-repetition" | "fifty-move-rule";

/** A read-only snapshot of the game. Views draw themselves from this. */
export interface Position {
  /** The position as a FEN string (the format chess engines understand). */
  fen: string;
  turn: Color;
  /** Every occupied square and the piece on it. */
  pieces: Record<Square, Piece>;
  /** True when the side to move has its king attacked. */
  inCheck: boolean;
  status: GameStatus;
  /** Set when status is "checkmate". */
  winner?: Color;
  /** Set when status is "draw". */
  drawReason?: DrawReason;
  /** All moves played so far, oldest first. */
  history: MoveRecord[];
  lastMove?: MoveRecord;
}

/** Why a move was refused. The UI turns these into friendly messages. */
export type MoveRejection =
  | "game-over"
  | "invalid-square"
  | "no-piece"
  | "not-your-turn"
  | "illegal"
  | "needs-promotion";

export type MoveResult = { ok: true; move: MoveRecord } | { ok: false; reason: MoveRejection };

export type PositionListener = (position: Position) => void;

/**
 * The small interface every input source uses to drive the game:
 * the mouse today, a VR controller or a camera later.
 */
export interface GameInput {
  /** Try to play a move. Nothing changes if the move is refused. */
  attemptMove(from: Square, to: Square, promotion?: PromotionPiece): MoveResult;
  /** The squares the piece on `from` may legally move to. */
  legalMovesFrom(from: Square): Square[];
  /** True if this move is a pawn reaching the last rank. */
  isPromotionMove(from: Square, to: Square): boolean;
  getPosition(): Position;
  /** Calls `listener` after every change. Returns a function that stops it. */
  onPositionChanged(listener: PositionListener): () => void;
}

/**
 * Checks that a string names a real square ("a1" to "h8").
 * Input can come from a mouse, a VR controller or a camera, so core/
 * validates it before using it.
 */
export function isSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value);
}
