import { Chess } from "chess.js";
import type { Move } from "chess.js";
import type { EngineLine } from "../engine/engine";
import { PIECE_NAMES, PROMOTION_CODES } from "../game/chessJsHelpers";
import { moveInWords } from "../hints/boardFacts";
import { explainMove } from "../hints/hint";
import type { IdeaLabel } from "../model/moveClassifier";
import type { Color, MoveChoice, PieceType, Square } from "../types";
import { findThreatenedPieces, PIECE_VALUES } from "./threats";

/** How good a move was, compared with the best move available. */
export type MoveQuality = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

/** The kind of error, used to choose advice after the game. */
export type MistakeTheme = "hung-piece" | "missed-capture" | "missed-mate" | "allowed-mate" | "other";

/** The verdict on one move the player made. */
export interface MoveReview {
  /** Position of the move in the game's history, counting from 0. */
  ply: number;
  /** The move number as shown in the move list (1, 2, 3...). */
  moveNumber: number;
  san: string;
  quality: MoveQuality;
  /** How much worse than the best move it was, in centipawns (100 = one pawn). */
  lossCp: number;
  /** Set for inaccuracies, mistakes and blunders. */
  theme: MistakeTheme | null;
  /** A plain-English explanation of what went wrong, or null for fine moves. */
  explanation: string | null;
  /** The move the engine preferred. */
  best: MoveChoice | null;
  /** The position the move was played in, and the move itself. */
  fenBefore: string;
  played: MoveChoice;
  /**
   * Set when the move put a piece where it can be captured at a loss.
   * Whether that is a sacrifice or a blunder depends on `quality`: if the
   * move is still good, the material was given up on purpose and it works.
   */
  offered: { piece: PieceType; square: Square } | null;
  /** Ideas the trained model recognised in the move (fork, pin...). Empty without a model. */
  ideas: IdeaLabel[];
}

/** A piece counts as "given up" when at least this many points are at risk. */
const MIN_OFFERED_VALUE = 2;

/**
 * Checks whether a move leaves the moved piece where it can be captured at a
 * loss. A knight stepping onto a square a pawn attacks is an offer; a bishop
 * taking a defended knight is an even trade and is not.
 */
function findOffer(played: Move): MoveReview["offered"] {
  const me: Color = played.color === "w" ? "white" : "black";
  const arrived = PIECE_NAMES[played.promotion ?? played.piece];
  const atRisk = findThreatenedPieces(played.after, me).some((threat) => threat.square === played.to);
  if (!atRisk) return null;
  const alreadyWon = played.captured ? PIECE_VALUES[PIECE_NAMES[played.captured]] : 0;
  if (PIECE_VALUES[arrived] - alreadyWon < MIN_OFFERED_VALUE) return null;
  return { piece: arrived, square: played.to };
}

/**
 * How many centipawns worse than the best move each label starts at.
 * These are common values used by chess websites, rounded for beginners.
 */
export const THRESHOLDS = { inaccuracy: 60, mistake: 150, blunder: 300 };

/**
 * Scores are capped at ten pawns either way. Beyond that the game is
 * already decided, so the difference between +15 and +25 should not be
 * reported as a blunder.
 */
const SCORE_CAP = 1000;

/** Turns an engine line into one number, from the point of view of the side to move. */
export function scoreOf(line: EngineLine | undefined): number {
  if (!line) return 0;
  if (line.mateIn !== undefined) return line.mateIn > 0 ? SCORE_CAP : -SCORE_CAP;
  return Math.max(-SCORE_CAP, Math.min(SCORE_CAP, line.scoreCp ?? 0));
}

export function classify(lossCp: number): MoveQuality {
  if (lossCp >= THRESHOLDS.blunder) return "blunder";
  if (lossCp >= THRESHOLDS.mistake) return "mistake";
  if (lossCp >= THRESHOLDS.inaccuracy) return "inaccuracy";
  return "good";
}

export interface ReviewInput {
  ply: number;
  san: string;
  fenBefore: string;
  played: MoveChoice;
  /** The engine's best line in the position BEFORE the move. */
  bestLine: EngineLine | undefined;
  /**
   * The engine's best line for the OPPONENT in the position after the move.
   * Not needed when the best move was played or the move ended the game.
   */
  replyLine?: EngineLine;
}

function sameMove(a: MoveChoice, b: MoveChoice): boolean {
  return a.from === b.from && a.to === b.to && (a.promotion ?? null) === (b.promotion ?? null);
}

function playOn(fen: string, move: MoveChoice): { chess: Chess; move: Move } | null {
  const chess = new Chess(fen);
  try {
    const played = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion ? PROMOTION_CODES[move.promotion] : undefined,
    });
    return { chess, move: played };
  } catch {
    return null;
  }
}

/**
 * Says whether playing `move` in the position `fen` would put the moved
 * piece where it can be captured at a loss. Null if not, or if the move is illegal.
 */
export function offeredPiece(fen: string, move: MoveChoice): MoveReview["offered"] {
  const result = playOn(fen, move);
  return result ? findOffer(result.move) : null;
}

/**
 * Judges one move. The idea is simple: the engine says how good the position
 * was with the best move, and how good it is after the move actually played.
 * The difference is how much the move cost.
 */
export function reviewMove(input: ReviewInput): MoveReview {
  const { ply, san, fenBefore, played, bestLine, replyLine } = input;
  const best = bestLine?.move ?? null;
  const after = playOn(fenBefore, played);
  const base = {
    ply,
    moveNumber: Math.floor(ply / 2) + 1,
    san,
    best,
    fenBefore,
    played,
    offered: after ? findOffer(after.move) : null,
    // Filled in afterwards by the reviewer, if a trained model is available.
    ideas: [] as IdeaLabel[],
  };
  const fine = (quality: "best" | "good"): MoveReview => ({
    ...base,
    quality,
    lossCp: 0,
    theme: null,
    explanation: null,
  });

  if (!after || !best) return fine("good");
  // Delivering checkmate, or playing the engine's own choice, cannot be improved on.
  if (after.chess.isCheckmate() || sameMove(played, best)) return fine("best");

  // The reply line is scored for the opponent, so flip its sign to get ours.
  const scoreWithBest = scoreOf(bestLine);
  const scoreAfterMove = after.chess.isGameOver() ? 0 : -scoreOf(replyLine);
  const lossCp = Math.max(0, scoreWithBest - scoreAfterMove);

  let quality = classify(lossCp);
  // Missing a checkmate in one is always worth pointing out, even when still winning.
  const missedMateInOne = bestLine?.mateIn === 1;
  if (missedMateInOne && (quality === "good" || quality === "inaccuracy")) quality = "mistake";
  if (quality === "good") return { ...fine("good"), lossCp };

  const { theme, explanation } = explain(fenBefore, after.move, best, bestLine, replyLine);
  return { ...base, quality, lossCp, theme, explanation };
}

/** Works out what kind of mistake a move was and describes it in a sentence or two. */
function explain(
  fenBefore: string,
  played: Move,
  best: MoveChoice,
  bestLine: EngineLine | undefined,
  replyLine: EngineLine | undefined,
): { theme: MistakeTheme; explanation: string } {
  const me: Color = played.color === "w" ? "white" : "black";
  const bestPlayed = playOn(fenBefore, best);
  const bestWords = bestPlayed ? moveInWords(bestPlayed.move) : "a different move";
  const better = `A better move was ${bestWords}.`;

  // 1. The move lets the opponent force checkmate.
  if (replyLine?.mateIn !== undefined && replyLine.mateIn > 0) {
    const moves = replyLine.mateIn === 1 ? "on the next move" : `in ${replyLine.mateIn} moves`;
    return {
      theme: "allowed-mate",
      explanation: `This lets your opponent force checkmate ${moves}. ${better}`,
    };
  }

  // 2. There was a checkmate available.
  if (bestLine?.mateIn === 1) {
    return { theme: "missed-mate", explanation: `You had checkmate in one move: ${bestWords}.` };
  }

  // 3. A piece was left where it can be captured.
  const threatsBefore = findThreatenedPieces(fenBefore, me);
  const threatsAfter = findThreatenedPieces(played.after, me);
  const newThreat = threatsAfter.find((threat) => !threatsBefore.some((old) => old.square === threat.square));
  if (newThreat) {
    const how = newThreat.kind === "hanging" ? "with nothing defending it" : "which is worth less";
    return {
      theme: "hung-piece",
      explanation: `This left your ${newThreat.piece} on ${newThreat.square} attacked by the ${newThreat.attacker} on ${newThreat.attackerSquare}, ${how}. ${better}`,
    };
  }
  const ignored = threatsAfter.find((threat) => threatsBefore.some((old) => old.square === threat.square));
  if (ignored) {
    return {
      theme: "hung-piece",
      explanation: `Your ${ignored.piece} on ${ignored.square} was under attack by the ${ignored.attacker} on ${ignored.attackerSquare}, and this move did not deal with it. ${better}`,
    };
  }

  // 4. A winning capture was available.
  if (bestPlayed?.move.captured) {
    const captured = PIECE_NAMES[bestPlayed.move.captured];
    const capturer = PIECE_NAMES[bestPlayed.move.piece];
    const enemyCode = played.color === "w" ? "b" : "w";
    const defended = new Chess(fenBefore).attackers(bestPlayed.move.to, enemyCode).length > 0;
    if (!defended || PIECE_VALUES[captured] > PIECE_VALUES[capturer]) {
      return {
        theme: "missed-capture",
        explanation: `You could have won a ${captured}: ${bestWords}.`,
      };
    }
  }

  // 5. Anything else: say what the better move would have done.
  const why = explainMove(fenBefore, best, { line: bestLine })?.reasons[0];
  const reason = why && why.kind !== null ? ` ${why.text}` : "";
  return { theme: "other", explanation: `${better}${reason}` };
}
