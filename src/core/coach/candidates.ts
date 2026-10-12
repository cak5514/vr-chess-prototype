import { Chess } from "chess.js";
import type { Move } from "chess.js";
import { offeredPiece, scoreOf } from "../analysis/moveReview";
import { findThreatenedPieces, PIECE_VALUES } from "../analysis/threats";
import type { ChessEngine, EngineLine } from "../engine/engine";
import { PIECE_NAMES, PROMOTION_CODES } from "../game/chessJsHelpers";
import { moveInWords } from "../hints/boardFacts";
import { explainMove } from "../hints/hint";
import type { ArrowMark, HintContext, MovePurpose, SquareMark } from "../hints/hint";
import type { IdeaLabel, MoveClassifier } from "../model/moveClassifier";
import type { Color, MoveChoice, PieceType, Square } from "../types";

// Coach mode: before the player moves, list the sound moves available,
// sorted by what kind of move each one is. The player picks by the idea
// they prefer. The coach never says which move is best.
//
// The engine supplies the candidates and guarantees they are sound. The
// trained model and the hint rules decide which category each belongs to.

export type MoveCategory = "attack" | "defend" | "prepare-attack" | "prepare-defence" | "trap" | "sacrifice";

/** The categories in the order they are shown, with words for the player. */
export const CATEGORIES: { id: MoveCategory; label: string; description: string }[] = [
  { id: "attack", label: "Attack", description: "Capture something, give check, or make a direct threat." },
  { id: "defend", label: "Defend", description: "Deal with a threat against you right now." },
  { id: "prepare-attack", label: "Prepare an attack", description: "Bring pieces to better squares before striking." },
  { id: "prepare-defence", label: "Prepare your defence", description: "Make your position safer before trouble starts." },
  { id: "trap", label: "Set a trap", description: "Offer something that is a mistake to take." },
  { id: "sacrifice", label: "Sacrifice", description: "Give up material on purpose for something bigger." },
];

/** One move the coach suggests. */
export interface Candidate {
  move: MoveChoice;
  /** The move in notation, e.g. "Nf3". */
  san: string;
  /** The move in words, e.g. "Knight to f3". */
  title: string;
  category: MoveCategory;
  /** One sentence on what the move does. */
  reason: string;
  /** Names of ideas the trained model recognised, e.g. "fork". */
  ideas: IdeaLabel[];
  /** What to highlight on the board when the player looks at this move. */
  squares: SquareMark[];
  arrows: ArrowMark[];
}

export interface CandidateGroup {
  category: MoveCategory;
  label: string;
  description: string;
  candidates: Candidate[];
}

/** How far ahead the engine looks when listing candidates. */
export const COACH_DEPTH = 10;
/** The longest list the coach will show. More than this is too much to read each turn. */
export const MAX_CANDIDATES = 8;
/**
 * A move counts as sound if it is within this many centipawns of the best
 * move (100 = one pawn). Anything worse is left off the list. This is kept
 * below the Commenter's "inaccuracy" threshold (60), so the coach does not
 * suggest a move the Commenter would then criticise.
 */
export const SOUND_MARGIN = 50;
/** If taking the bait costs the opponent at least this much, the move is a trap. */
const POISON_MARGIN = 150;

/** Something left where the opponent can capture it. */
export interface Bait {
  piece: PieceType;
  square: Square;
}

/** How the bait turned out when the engine checked it. */
export type BaitVerdict = "poisoned" | "playable" | null;

const ATTACK_IDEAS: IdeaLabel[] = ["fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "capturingDefender"];
const TRAP_IDEAS: IdeaLabel[] = ["attraction", "deflection", "trappedPiece"];

/** Keeps the engine's lines that are close enough to the best one to recommend. */
export function selectSound(lines: EngineLine[]): EngineLine[] {
  if (lines.length === 0) return [];
  const best = scoreOf(lines[0]);
  return lines.filter((line) => best - scoreOf(line) <= SOUND_MARGIN).slice(0, MAX_CANDIDATES);
}

function play(fen: string, move: MoveChoice): { chess: Chess; move: Move } | null {
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
 * Finds what a move leaves for the opponent to capture: either the moved
 * piece itself, or a pawn that becomes undefended because of the move.
 */
export function findBait(fen: string, move: MoveChoice): Bait | null {
  const offered = offeredPiece(fen, move);
  if (offered) return offered;

  const result = play(fen, move);
  if (!result) return null;
  const me: Color = result.move.color === "w" ? "white" : "black";
  const before = findThreatenedPieces(fen, me);
  const newlyHanging = findThreatenedPieces(result.move.after, me).find((threat) => {
    if (threat.kind !== "hanging" || threat.piece !== "pawn") return false;
    // A pawn that has just captured something and can be taken back is a
    // trade, not an offer: nothing is being given up.
    if (threat.square === result.move.to && result.move.captured) return false;
    return !before.some((old) => old.square === threat.square);
  });
  return newlyHanging ? { piece: "pawn", square: newlyHanging.square } : null;
}

/**
 * Decides which category a move belongs to.
 *
 * - The bait check comes first: bait that punishes the capture is a trap,
 *   and bait that can safely be taken is a real sacrifice.
 * - Then a sacrifice recognised by the trained model.
 * - A move that already attacks something directly is an attack, whatever
 *   else the model sees in it. (Without this, the model's "luring" labels
 *   turned ordinary captures into traps.)
 * - For quieter moves the model can still upgrade the category: a luring
 *   idea makes it a trap, a tactic makes it an attack.
 * - Otherwise the hint rules' main reason for the move decides.
 */
export function decideCategory(purpose: MovePurpose, ideas: IdeaLabel[], bait: BaitVerdict): MoveCategory {
  if (bait === "poisoned") return "trap";
  if (bait === "playable" || ideas.includes("sacrifice")) return "sacrifice";
  if (purpose === "attack") return "attack";
  if (ideas.some((idea) => TRAP_IDEAS.includes(idea))) return "trap";
  if (ideas.some((idea) => ATTACK_IDEAS.includes(idea))) return "attack";
  return purpose;
}

/** Builds the coach's entry for one move. Null if the move is not legal. */
export function buildCandidate(
  fen: string,
  line: EngineLine,
  ideas: IdeaLabel[],
  bait: Bait | null,
  verdict: BaitVerdict,
  lastMove?: HintContext["lastMove"],
): Candidate | null {
  const result = play(fen, line.move);
  const hint = explainMove(fen, line.move, { line, lastMove });
  if (!result || !hint) return null;

  const main = hint.reasons[0];
  const category = decideCategory(main.purpose, ideas, verdict);

  let reason = main.text;
  // The rules' fallback sentence was written for a single hint.
  if (reason.startsWith("This is a quiet move")) reason = "A calm move that keeps your position solid.";
  if (bait && category === "trap") {
    reason = `It leaves your ${bait.piece} on ${bait.square} looking free, but taking it is a mistake for your opponent.`;
  } else if (bait && category === "sacrifice") {
    reason = `It gives up your ${bait.piece} on ${bait.square} to get something bigger in return.`;
  }

  const words = moveInWords(result.move);
  return {
    move: line.move,
    san: result.move.san,
    title: words.charAt(0).toUpperCase() + words.slice(1),
    category,
    reason,
    ideas: ideas.filter((idea) => idea !== "ordinary"),
    squares: hint.reasons.flatMap((item) => item.squares),
    arrows: hint.reasons.flatMap((item) => item.arrows),
  };
}

/** Sorts candidates into their categories, leaving out empty ones. */
export function groupByCategory(candidates: Candidate[]): CandidateGroup[] {
  return CATEGORIES.map(({ id, label, description }) => ({
    category: id,
    label,
    description,
    // Alphabetical inside a group, so the order does not give away which move is best.
    candidates: candidates.filter((item) => item.category === id).sort((a, b) => a.title.localeCompare(b.title)),
  })).filter((group) => group.candidates.length > 0);
}

/**
 * Asks the engine whether capturing the bait is a mistake for the opponent.
 * `scoreIfDeclined` is how good the position is for us when the opponent
 * plays their best reply instead.
 */
async function judgeBait(
  engine: ChessEngine,
  fen: string,
  move: MoveChoice,
  bait: Bait,
  scoreIfDeclined: number,
): Promise<BaitVerdict> {
  const afterMove = play(fen, move);
  if (!afterMove) return null;

  // Find the opponent's cheapest way to capture the bait.
  const captures = afterMove.chess
    .moves({ verbose: true })
    .filter((reply) => reply.to === bait.square && reply.captured)
    .sort((a, b) => PIECE_VALUES[PIECE_NAMES[a.piece]] - PIECE_VALUES[PIECE_NAMES[b.piece]]);
  if (captures.length === 0) return null;

  afterMove.chess.move(captures[0]);
  if (afterMove.chess.isGameOver()) return "playable";
  // It is our turn again, so this score is from our point of view.
  const result = await engine.analyse({ fen: afterMove.chess.fen(), depth: COACH_DEPTH, skillLevel: 20, lines: 1 });
  const scoreIfTaken = scoreOf(result.lines[0]);
  return scoreIfTaken - scoreIfDeclined >= POISON_MARGIN ? "poisoned" : "playable";
}

/**
 * Lists the sound moves in a position, each with its category and reason.
 * `classifier` may be null, in which case only the rules decide categories.
 */
export async function findCandidates(
  engine: ChessEngine,
  classifier: MoveClassifier | null,
  fen: string,
  lastMove?: HintContext["lastMove"],
): Promise<Candidate[]> {
  const result = await engine.analyse({ fen, depth: COACH_DEPTH, skillLevel: 20, lines: MAX_CANDIDATES });
  const lines = selectSound(result.lines);
  if (lines.length === 0) return [];

  let ideas: IdeaLabel[][] = lines.map(() => []);
  if (classifier) {
    try {
      const answers = await classifier.classify(fen, lines.map((line) => line.move));
      ideas = answers.map((answer) => answer.ideas.map((idea) => idea.label));
    } catch {
      // Without the model the rules still give every move a category.
    }
  }

  const candidates: Candidate[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bait = findBait(fen, line.move);
    const verdict = bait ? await judgeBait(engine, fen, line.move, bait, scoreOf(line)) : null;
    const candidate = buildCandidate(fen, line, ideas[i], bait, verdict, lastMove);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}
