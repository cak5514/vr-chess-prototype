import type { Color, GameInput, PromotionPiece, Square } from "../types";

/** What the player has picked so far. Views highlight squares from this. */
export interface SelectionState {
  /** The square of the piece the player picked up, if any. */
  selected: Square | null;
  /** Where that piece may legally go. */
  targets: Square[];
  /** Set while we wait for the player to choose a promotion piece. */
  pendingPromotion: { from: Square; to: Square } | null;
}

const EMPTY: SelectionState = { selected: null, targets: [], pendingPromotion: null };

/**
 * Turns "the player pointed at a square" into moves.
 *
 * It holds the pick-a-piece-then-pick-a-square logic in one place, so the 2D
 * board, the 3D board and later the VR controller all behave the same way.
 */
export class MoveSelector {
  private state: SelectionState = EMPTY;
  private movableColors: Color[] = ["white", "black"];
  private listeners = new Set<() => void>();

  constructor(private game: GameInput) {
    // A move, undo or new game makes the old selection meaningless.
    game.onPositionChanged(() => this.setState(EMPTY));
  }

  getState(): SelectionState {
    return this.state;
  }

  /** Limits which side the player may move, e.g. only white against the computer. */
  setMovableColors(colors: Color[]): void {
    this.movableColors = colors;
    this.setState(EMPTY);
  }

  /** The player clicked or tapped a square. */
  pick(square: Square): void {
    if (this.state.pendingPromotion) return;

    const { selected, targets } = this.state;
    if (selected && targets.includes(square)) {
      this.tryMove(selected, square);
    } else if (square !== selected && this.canPickUp(square)) {
      this.setState({
        selected: square,
        targets: this.game.legalMovesFrom(square),
        pendingPromotion: null,
      });
    } else {
      // Clicking the same piece again, or anywhere else, puts it down.
      this.setState(EMPTY);
    }
  }

  /** The player dragged a piece from one square and let go on another. */
  drop(from: Square, to: Square): void {
    if (this.state.pendingPromotion || !this.canPickUp(from)) return;
    // An illegal drop is ignored and the piece stays selected.
    if (this.game.legalMovesFrom(from).includes(to)) this.tryMove(from, to);
  }

  /** The player chose what the pawn becomes. */
  choosePromotion(piece: PromotionPiece): void {
    const pending = this.state.pendingPromotion;
    if (!pending) return;
    this.game.attemptMove(pending.from, pending.to, piece);
    this.setState(EMPTY);
  }

  cancelPromotion(): void {
    if (this.state.pendingPromotion) this.setState(EMPTY);
  }

  /** Calls `listener` whenever the selection changes. Returns a function that stops it. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private canPickUp(square: Square): boolean {
    const position = this.game.getPosition();
    if (position.status !== "playing") return false;
    const piece = position.pieces[square];
    if (!piece) return false;
    return piece.color === position.turn && this.movableColors.includes(piece.color);
  }

  private tryMove(from: Square, to: Square): void {
    if (this.game.isPromotionMove(from, to)) {
      // Pause here until the player chooses a piece.
      this.setState({ selected: from, targets: [], pendingPromotion: { from, to } });
      return;
    }
    this.game.attemptMove(from, to);
    this.setState(EMPTY);
  }

  private setState(next: SelectionState): void {
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}
