import type { MoveChoice, PromotionPiece } from "../types";

// Helpers for reading the text lines a UCI engine prints.

const PROMOTION_LETTERS: Record<string, PromotionPiece> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

/** Turns engine notation like "e2e4" or "e7e8q" into a move. */
export function parseUciMove(text: string): MoveChoice | null {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text);
  if (!match) return null;
  return {
    from: match[1],
    to: match[2],
    promotion: match[3] ? PROMOTION_LETTERS[match[3]] : undefined,
  };
}

/**
 * Reads the engine's final answer, e.g. "bestmove e2e4 ponder e7e5".
 * Returns undefined if the line is not a bestmove line, and null if the
 * engine says there is no move to play ("bestmove (none)").
 */
export function parseBestMove(line: string): MoveChoice | null | undefined {
  const match = /^bestmove (\S+)/.exec(line);
  if (!match) return undefined;
  return parseUciMove(match[1]);
}

export interface InfoLine {
  depth: number;
  /** Rank of this candidate: 1 is the best move, 2 the second best, ... */
  rank: number;
  move: MoveChoice;
  /** The whole line the engine expects, starting with `move`. */
  pv: MoveChoice[];
  scoreCp?: number;
  mateIn?: number;
}

/**
 * Reads a progress line, e.g.
 * "info depth 8 multipv 1 score cp 31 nodes 900 pv e2e4 e7e5".
 * Returns null for info lines that do not describe a candidate move.
 */
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith("info ")) return null;
  // "lowerbound"/"upperbound" scores are unfinished estimates, so skip them.
  if (/\b(lowerbound|upperbound)\b/.test(line)) return null;

  const depth = /\bdepth (\d+)/.exec(line);
  const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
  // " pv " with spaces, so the word "multipv" earlier in the line does not match.
  const pvText = / pv (.+)$/.exec(line);
  if (!depth || !score || !pvText) return null;

  // Keep the moves up to the first one we cannot read.
  const pv: MoveChoice[] = [];
  for (const text of pvText[1].trim().split(/\s+/)) {
    const parsed = parseUciMove(text);
    if (!parsed) break;
    pv.push(parsed);
  }
  if (pv.length === 0) return null;
  const move = pv[0];

  const rank = /\bmultipv (\d+)/.exec(line);
  const value = Number(score[2]);
  return {
    depth: Number(depth[1]),
    rank: rank ? Number(rank[1]) : 1,
    move,
    pv,
    scoreCp: score[1] === "cp" ? value : undefined,
    mateIn: score[1] === "mate" ? value : undefined,
  };
}
