// The public face of core/.
// ui/, modes/ and platform/ import from this file only, never from
// the folders inside core/.

export { Game } from "./game/game";
export { isSquare } from "./types";
export type {
  Color,
  DrawReason,
  GameInput,
  GameStatus,
  MoveRecord,
  MoveRejection,
  MoveResult,
  Piece,
  PieceType,
  Position,
  PositionListener,
  PromotionPiece,
  Square,
} from "./types";
