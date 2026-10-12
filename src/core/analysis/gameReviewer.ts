import { Chess } from "chess.js";
import type { ChessEngine } from "../engine/engine";
import type { Game } from "../game/game";
import type { Color, MoveRecord } from "../types";
import { reviewMove } from "./moveReview";
import type { MoveReview } from "./moveReview";

/** How far ahead the engine looks when judging a move. */
export const REVIEW_DEPTH = 10;

/**
 * Reviews the player's moves while the game is being played.
 *
 * It watches the game. Each time the player moves, it asks the engine two
 * questions in the background: "what was the best move here?" and "how good
 * is the position now?". The answers become a MoveReview. By the time the
 * game ends, the feedback is already there.
 */
export class GameReviewer {
  /** Finished reviews, by the move's place in the history. */
  private reviews = new Map<number, { fenAfter: string; review: MoveReview }>();
  /** Moves that are waiting for the engine, so they are not queued twice. */
  private queued = new Set<string>();
  /** Reviews run one after another, in the order the moves were played. */
  private chain: Promise<void> = Promise.resolve();
  private playerColor: Color | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private game: Game,
    private engine: ChessEngine,
    private depth: number = REVIEW_DEPTH,
  ) {
    game.onPositionChanged(() => this.sync());
  }

  /** Sets whose moves to review. `null` switches reviewing off. */
  setPlayerColor(color: Color | null): void {
    if (color === this.playerColor) return;
    this.playerColor = color;
    this.reviews.clear();
    this.sync();
    this.emit();
  }

  /** The reviews for the current game, in the order the moves were played. */
  getReviews(): MoveReview[] {
    return [...this.reviews.entries()].sort(([a], [b]) => a - b).map(([, entry]) => entry.review);
  }

  /** How many of the player's moves are still waiting to be reviewed. */
  pendingCount(): number {
    return this.queued.size;
  }

  /** Resolves when every move played so far has been reviewed. Mostly for tests. */
  whenIdle(): Promise<void> {
    return this.chain;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Brings the reviews in line with the game after any change (move, undo, new game). */
  private sync(): void {
    const history = this.game.getPosition().history;

    // Forget reviews of moves that have been undone or replaced.
    let removed = false;
    for (const [ply, entry] of this.reviews) {
      if (history[ply]?.fenAfter !== entry.fenAfter) {
        this.reviews.delete(ply);
        removed = true;
      }
    }
    if (removed) this.emit();

    history.forEach((move, ply) => {
      if (move.color !== this.playerColor || this.reviews.has(ply)) return;
      const key = `${ply}:${move.fenAfter}`;
      if (this.queued.has(key)) return;
      this.queued.add(key);
      this.chain = this.chain.then(() => this.review(ply, move, key));
    });
  }

  private isStillPlayed(ply: number, move: MoveRecord): boolean {
    return this.game.getPosition().history[ply]?.fenAfter === move.fenAfter;
  }

  private async review(ply: number, move: MoveRecord, key: string): Promise<void> {
    try {
      // The move may have been undone while it waited in the queue.
      if (!this.isStillPlayed(ply, move) || move.color !== this.playerColor) return;

      const played = { from: move.from, to: move.to, promotion: move.promotion };
      const before = await this.engine.analyse({ fen: move.fenBefore, depth: this.depth, skillLevel: 20, lines: 1 });
      const bestLine = before.lines[0];

      // The second question is only needed when the player chose a different move.
      const playedBest = bestLine && bestLine.move.from === move.from && bestLine.move.to === move.to;
      const gameEnded = new Chess(move.fenAfter).isGameOver();
      let replyLine;
      if (!playedBest && !gameEnded) {
        const after = await this.engine.analyse({ fen: move.fenAfter, depth: this.depth, skillLevel: 20, lines: 1 });
        replyLine = after.lines[0];
      }

      if (!this.isStillPlayed(ply, move)) return;
      const review = reviewMove({ ply, san: move.san, fenBefore: move.fenBefore, played, bestLine, replyLine });
      this.reviews.set(ply, { fenAfter: move.fenAfter, review });
    } catch {
      // If the engine fails, this move simply goes unreviewed.
    } finally {
      this.queued.delete(key);
      this.emit();
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
