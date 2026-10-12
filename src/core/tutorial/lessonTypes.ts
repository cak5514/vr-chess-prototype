import type { Color, PieceType, Square } from "../types";

// The shapes that describe a lesson. Lesson content lives in lessons.ts
// (the basics) and strategyLessons.ts (tactics, checkmates, openings, gambits).
//
// Each lesson is a list of small steps:
// - "info": read an explanation and look at the board
// - "pick": click the right square
// - "move": make a move (or two) that reaches a goal
//
// Positions are written as FEN, the standard one-line notation for a chess
// position. Capital letters are white pieces, small letters are black, and
// numbers are runs of empty squares. The learner plays the side to move.

export type LessonId =
  // Basics
  | "board"
  | "rook"
  | "bishop"
  | "queen"
  | "knight"
  | "king"
  | "pawn"
  // Tactics
  | "fork"
  | "pin"
  | "skewer"
  | "discovered-attack"
  // Checkmates
  | "back-rank-mate"
  | "queen-mate"
  | "rook-mate"
  // Openings
  | "italian-game"
  | "ruy-lopez-black"
  // Gambits and traps
  | "queens-gambit"
  | "kings-gambit"
  | "scholars-mate"
  | "legals-trap";

/** The sections the lesson list is divided into. */
export type LessonGroup = "basics" | "tactics" | "checkmates" | "openings" | "gambits";

export const LESSON_GROUPS: { id: LessonGroup; title: string; description: string }[] = [
  { id: "basics", title: "The basics", description: "The board and how each piece moves." },
  { id: "tactics", title: "Tactics", description: "Short tricks that win material." },
  { id: "checkmates", title: "Checkmates", description: "How to finish a game you are winning." },
  { id: "openings", title: "Openings", description: "Good ways to start a game." },
  { id: "gambits", title: "Gambits and traps", description: "Giving something up to gain more, and traps to avoid." },
];

/** What the learner has to achieve in a "move" step. */
export type MoveGoal =
  /** Get a white piece onto `square`. */
  | { type: "reach"; square: Square; maxMoves?: number }
  /** Capture every black piece (kings do not count). */
  | { type: "capture-all"; maxMoves?: number }
  /** Play exactly this move, or one of the equally good moves listed in `or`. */
  | { type: "play"; from: Square; to: Square; or?: { from: Square; to: Square }[] }
  /** Promote a pawn. */
  | { type: "promote" }
  /** Give checkmate, by any move. */
  | { type: "checkmate" }
  /** Any legal move will do. */
  | { type: "any" };

interface StepBase {
  text: string;
  fen: string;
  /** Squares to highlight. */
  marks?: Square[];
  /** Highlight every square the piece on this square can move to. */
  showMovesOf?: Square;
  /** A move to highlight as "just played", e.g. the opponent's reply. */
  shownMove?: { from: Square; to: Square };
}

export interface InfoStep extends StepBase {
  kind: "info";
}

export interface PickStep extends StepBase {
  kind: "pick";
  answer: Square;
  success: string;
}

export interface MoveStep extends StepBase {
  kind: "move";
  goal: MoveGoal;
  success: string;
}

export type LessonStep = InfoStep | PickStep | MoveStep;

export interface Lesson {
  id: LessonId;
  group: LessonGroup;
  title: string;
  summary: string;
  /** The piece shown as this lesson's icon. The board lesson has none. */
  piece?: PieceType;
  /** Which side sits at the bottom of the board. White unless stated. */
  orientation?: Color;
  steps: LessonStep[];
}
