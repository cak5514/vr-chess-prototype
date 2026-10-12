import { pickOpponentMove } from "../difficulty/levels";
import type { DifficultyLevel } from "../difficulty/levels";
import type { ChessEngine } from "../engine/engine";
import type { Game } from "../game/game";
import type { Color } from "../types";

export interface OpponentOptions {
  /**
   * The shortest time the computer "thinks" before moving. Without it the
   * reply appears instantly and a beginner can miss what happened.
   */
  thinkDelayMs?: number;
  /** Replaces Math.random in tests. */
  random?: () => number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Plays one side of the game. It watches the game, and whenever it is the
 * computer's turn it asks the engine for a move and plays it through the
 * same attemptMove() the human uses.
 */
export class ComputerOpponent {
  private computerColor: Color | null = null;
  private thinking = false;
  /** Goes up every time the situation changes, so stale engine answers are ignored. */
  private requestId = 0;
  private paused = false;
  private thinkingListeners = new Set<(thinking: boolean) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private thinkDelayMs: number;
  private random: () => number;

  constructor(
    private game: Game,
    private engine: ChessEngine,
    private level: DifficultyLevel,
    options: OpponentOptions = {},
  ) {
    this.thinkDelayMs = options.thinkDelayMs ?? 600;
    this.random = options.random ?? Math.random;
    game.onPositionChanged(() => this.update());
  }

  /** Sets which side the computer plays. `null` switches the computer off. */
  setComputerColor(color: Color | null): void {
    this.computerColor = color;
    this.update();
  }

  getComputerColor(): Color | null {
    return this.computerColor;
  }

  /** Takes effect from the computer's next move. */
  setLevel(level: DifficultyLevel): void {
    this.level = level;
  }

  isThinking(): boolean {
    return this.thinking;
  }

  /**
   * Takes back the player's last move. If the computer has already replied,
   * its reply is taken back too, so it is the player's turn again.
   */
  undoTurn(): boolean {
    this.paused = true;
    const undone = this.game.undo();
    if (undone && this.game.getPosition().turn === this.computerColor) this.game.undo();
    this.paused = false;
    this.update();
    return undone;
  }

  onThinkingChanged(listener: (thinking: boolean) => void): () => void {
    this.thinkingListeners.add(listener);
    return () => this.thinkingListeners.delete(listener);
  }

  onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /** Called after every change: start thinking if it is our turn, otherwise stand down. */
  private update(): void {
    if (this.paused) return;
    // Whatever we were waiting for no longer matches the board.
    this.requestId++;

    const position = this.game.getPosition();
    const isMyTurn = position.status === "playing" && position.turn === this.computerColor;
    if (!isMyTurn) {
      this.setThinking(false);
      return;
    }
    void this.think(position.fen, this.requestId);
  }

  private async think(fen: string, id: number): Promise<void> {
    this.setThinking(true);
    try {
      const [result] = await Promise.all([
        this.engine.analyse({ fen, depth: this.level.depth, skillLevel: this.level.skillLevel }),
        wait(this.thinkDelayMs),
      ]);
      // The player undid, restarted or switched sides while we were thinking.
      if (id !== this.requestId) return;

      const move = pickOpponentMove(result, this.game.allLegalMoves(), this.level, this.random);
      this.setThinking(false);
      if (move) this.game.attemptMove(move.from, move.to, move.promotion ?? this.defaultPromotion(move));
    } catch (error) {
      if (id !== this.requestId) return;
      this.setThinking(false);
      const problem = error instanceof Error ? error : new Error(String(error));
      for (const listener of this.errorListeners) listener(problem);
    }
  }

  /** Promotion moves always arrive with a piece; this is only a safety net. */
  private defaultPromotion(move: { from: string; to: string }) {
    return this.game.isPromotionMove(move.from, move.to) ? ("queen" as const) : undefined;
  }

  private setThinking(value: boolean): void {
    if (this.thinking === value) return;
    this.thinking = value;
    for (const listener of this.thinkingListeners) listener(value);
  }
}
