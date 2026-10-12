import type { MistakeTheme, MoveReview } from "../analysis/moveReview";
import type { Color, Position } from "../types";

export type GameResult = "win" | "loss" | "draw";

/** Everything the post-game feedback screen shows. */
export interface GameSummary {
  result: GameResult;
  /** One sentence saying how the game ended. */
  resultText: string;
  /** How many moves the player made. */
  playerMoves: number;
  /** Enemy pieces the player captured, and pieces the player lost. */
  capturesByPlayer: number;
  capturesByOpponent: number;
  /** How many of the player's reviewed moves fell into each group. */
  counts: { good: number; inaccuracy: number; mistake: number; blunder: number };
  /** Share of reviewed moves that were good, 0 to 100. Null if none were reviewed. */
  goodMovePercent: number | null;
  /** The costliest errors, worst first. */
  keyMistakes: MoveReview[];
  /** Advice for the next game. */
  recommendations: string[];
}

/** How many mistakes are listed in full. More than this is too much to take in. */
const MAX_KEY_MISTAKES = 3;
const MAX_RECOMMENDATIONS = 3;

/** By this move a beginner should normally have castled. */
const CASTLE_BY_MOVE = 12;

function describeResult(position: Position, result: GameResult): string {
  if (position.status === "checkmate") {
    return result === "win" ? "You won by checkmate." : "You lost by checkmate.";
  }
  if (position.status === "stalemate") {
    return "Draw by stalemate: the player to move had no legal move but was not in check.";
  }
  switch (position.drawReason) {
    case "insufficient-material":
      return "Draw: neither side had enough pieces left to give checkmate.";
    case "threefold-repetition":
      return "Draw: the same position appeared three times.";
    default:
      return "Draw: fifty moves passed without a capture or a pawn move.";
  }
}

/**
 * Builds the post-game summary from the final position and the move reviews.
 * Call it once the game is over.
 */
export function summariseGame(position: Position, reviews: MoveReview[], playerColor: Color): GameSummary {
  const result: GameResult =
    position.status === "checkmate" ? (position.winner === playerColor ? "win" : "loss") : "draw";

  const myMoves = position.history.filter((move) => move.color === playerColor);
  const theirMoves = position.history.filter((move) => move.color !== playerColor);

  const counts = { good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  for (const review of reviews) {
    if (review.quality === "best" || review.quality === "good") counts.good++;
    else counts[review.quality]++;
  }

  const errors = reviews.filter((review) => review.theme !== null);
  const keyMistakes = [...errors]
    // Inaccuracies are small; the list is for mistakes and blunders.
    .filter((review) => review.quality !== "inaccuracy")
    .sort((a, b) => b.lossCp - a.lossCp)
    .slice(0, MAX_KEY_MISTAKES);

  return {
    result,
    resultText: describeResult(position, result),
    playerMoves: myMoves.length,
    capturesByPlayer: myMoves.filter((move) => move.captured).length,
    capturesByOpponent: theirMoves.filter((move) => move.captured).length,
    counts,
    goodMovePercent: reviews.length > 0 ? Math.round((counts.good / reviews.length) * 100) : null,
    keyMistakes,
    recommendations: recommend({
      result,
      errors,
      counts,
      castled: myMoves.some((move) => move.isCastle),
      playerMoves: myMoves.length,
    }),
  };
}

interface AdviceInput {
  result: GameResult;
  errors: MoveReview[];
  counts: GameSummary["counts"];
  castled: boolean;
  playerMoves: number;
}

/**
 * Chooses advice from fixed rules. Each rule looks for one pattern in the
 * game, such as leaving pieces undefended more than once.
 */
function recommend(input: AdviceInput): string[] {
  const { result, errors, counts, castled, playerMoves } = input;
  const times = (theme: MistakeTheme) => errors.filter((review) => review.theme === theme).length;
  const advice: string[] = [];

  if (times("allowed-mate") > 0) {
    advice.push(
      "Before you move, ask what your opponent's most dangerous reply would be, especially any check on your king.",
    );
  }
  if (times("missed-mate") > 0) {
    advice.push("When the enemy king has few squares to run to, look at every check you can give. One of them may be checkmate.");
  }
  if (times("hung-piece") >= 2) {
    advice.push(
      "You left pieces where they could be captured more than once. Before each move, check that the piece you move, and the pieces it was protecting, are still safe.",
    );
  } else if (times("hung-piece") === 1) {
    advice.push("Before each move, check that none of your pieces can be captured for free.");
  }
  if (times("missed-capture") >= 1) {
    advice.push("Look at every capture you can make before choosing a move. A free piece is usually the best move on the board.");
  }
  if (!castled && playerMoves >= CASTLE_BY_MOVE) {
    advice.push("You did not castle this game. Castling early keeps your king safe and brings a rook into play.");
  }

  const seriousErrors = counts.mistake + counts.blunder;
  if (advice.length === 0) {
    if (result === "win" && seriousErrors === 0) {
      advice.push("A clean win with no serious mistakes. You are ready to try a harder opponent.");
    } else if (seriousErrors === 0) {
      advice.push("You made no serious mistakes. Keep playing to build experience, and use the hint button when you are unsure.");
    } else {
      advice.push("Take your time on each move. Use the hint button when you are unsure, and read why the move is good.");
    }
  }
  return advice.slice(0, MAX_RECOMMENDATIONS);
}
