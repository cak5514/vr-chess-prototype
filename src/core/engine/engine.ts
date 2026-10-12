import type { MoveChoice } from "../types";

/** What we ask the engine to look at. */
export interface EngineRequest {
  /** The position to think about, as a FEN string. */
  fen: string;
  /** How many half-moves ahead to search. Higher is stronger and slower. */
  depth: number;
  /** Stockfish's own strength setting, 0 (weakest) to 20 (full strength). */
  skillLevel?: number;
  /** How many of the best moves to report. Defaults to 1. */
  lines?: number;
}

/** One candidate move and how good the engine thinks it is. */
export interface EngineLine {
  move: MoveChoice;
  /**
   * The moves the engine expects from here, starting with `move`: ours, the
   * opponent's reply, ours again, and so on. Called the principal variation.
   */
  pv: MoveChoice[];
  /**
   * Score in centipawns (100 = one pawn) from the point of view of the side
   * to move. Positive means that side is better.
   */
  scoreCp?: number;
  /** Set instead of scoreCp when a forced checkmate was found: mate in N moves. */
  mateIn?: number;
}

export interface EngineResult {
  /** The move the engine chose to play, or null if there is no legal move. */
  bestMove: MoveChoice | null;
  /** The candidate moves it considered, best first. */
  lines: EngineLine[];
}

/**
 * Anything that can analyse a chess position. core/ only knows this
 * interface; the real Stockfish is plugged in from outside, and the tests
 * plug in a fake one.
 */
export interface ChessEngine {
  analyse(request: EngineRequest): Promise<EngineResult>;
  /** Shuts the engine down. */
  dispose(): void;
}

/**
 * A two-way text channel to an engine that speaks UCI, the standard chess
 * engine protocol. In the browser this is a Web Worker.
 */
export interface UciTransport {
  send(command: string): void;
  /** Registers the function that receives each line the engine prints. */
  onLine(handler: (line: string) => void): void;
  /** Registers the function called if the engine crashes or fails to load. */
  onError(handler: (error: Error) => void): void;
  close(): void;
}
