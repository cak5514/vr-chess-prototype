import type { Color, MarkKind, Position, Square, SquareMark } from "../../core/index";

/** An arrow on the board. "move" is the suggested move itself; the rest explain it. */
export interface BoardArrow {
  from: Square;
  to: Square;
  kind: "move" | MarkKind;
}

/** Everything a board needs in order to draw itself. */
export interface BoardViewState {
  position: Position;
  /** Which side sits at the bottom of the board. */
  orientation: Color;
  selected: Square | null;
  targets: Square[];
  /** Arrows to draw over the board: the suggested move and what explains it. */
  arrows: BoardArrow[];
  /** Squares to tint, e.g. the ones a hinted move controls. */
  marks: SquareMark[];
  /** Squares holding pieces the player should worry about. */
  warningSquares: Square[];
}

/** What a board reports back when the player touches it. */
export interface BoardViewEvents {
  /** A square was clicked or tapped. */
  onPick(square: Square): void;
  /** A piece was dragged from one square and released on another. */
  onDrop(from: Square, to: Square): void;
}

/**
 * The contract every board follows. The 2D board implements it now and the
 * 3D board will implement it later, so the rest of the app does not care
 * which one is on screen.
 */
export interface BoardView {
  render(state: BoardViewState): void;
  destroy(): void;
}
