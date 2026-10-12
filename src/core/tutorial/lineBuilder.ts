import { Chess } from "chess.js";
import { moveInWords } from "../hints/boardFacts";
import type { Color } from "../types";
import type { LessonStep } from "./lessonTypes";

// Builds the steps of a lesson that walks through a line of moves, such as
// an opening. The lesson author writes the moves in ordinary chess notation
// with a few words about each. This file works out every position along the
// way, so nobody has to write positions by hand.
//
// It also checks the line while building it: an illegal move, or a move
// whose notation does not match (for example a missing "+" for check or "#"
// for checkmate), stops the program with a clear message. A mistake in a
// lesson is therefore caught by the tests, not by a learner.

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** A move the learner has to play. */
export interface LearnerMove {
  /** The move in chess notation, e.g. "Nf3". */
  san: string;
  /** What to tell the learner to do. */
  ask: string;
  /** Shown after they play it: why it is a good move. */
  why: string;
}

/** A move the opponent plays in reply. */
export interface ReplyMove {
  san: string;
  /** A sentence about the reply, shown before the learner's next move. */
  note: string;
}

export interface Line {
  /** Which side the learner plays. */
  learner: Color;
  /** Where the line starts. The normal starting position unless stated. */
  startFen?: string;
  /** The moves in order, alternating between the two sides. */
  moves: (LearnerMove | ReplyMove)[];
}

function isLearnerMove(move: LearnerMove | ReplyMove): move is LearnerMove {
  return "ask" in move;
}

/** Turns a line of moves into "move" steps, one for each of the learner's moves. */
export function lineSteps(line: Line): LessonStep[] {
  const chess = new Chess(line.startFen ?? START);
  const learnerCode = line.learner === "white" ? "w" : "b";
  const steps: LessonStep[] = [];

  // What the opponent did just before the learner's next move.
  let replyNote = "";
  let replyMove: { from: string; to: string } | undefined;

  for (const item of line.moves) {
    const mover = chess.turn();
    const fenBefore = chess.fen();
    let played;
    try {
      played = chess.move(item.san);
    } catch {
      throw new Error(`Lesson line: "${item.san}" is not a legal move in ${fenBefore}`);
    }
    if (played.san !== item.san) {
      throw new Error(`Lesson line: "${item.san}" should be written "${played.san}"`);
    }

    if (isLearnerMove(item)) {
      if (mover !== learnerCode) throw new Error(`Lesson line: "${item.san}" is not the learner's move`);
      steps.push({
        kind: "move",
        fen: fenBefore,
        shownMove: replyMove,
        goal: { type: "play", from: played.from, to: played.to },
        text: `${replyNote}${item.ask}`,
        success: item.why,
      });
      replyNote = "";
      replyMove = undefined;
    } else {
      if (mover === learnerCode) throw new Error(`Lesson line: "${item.san}" is not the opponent's move`);
      const side = mover === "w" ? "White" : "Black";
      replyNote = `${side} plays ${moveInWords(played)}. ${item.note} `;
      replyMove = { from: played.from, to: played.to };
    }
  }
  return steps;
}

/** The position at the end of a line, for a closing "info" step. */
export function finalPosition(line: Line): { fen: string; lastMove: { from: string; to: string } | undefined } {
  const chess = new Chess(line.startFen ?? START);
  let last;
  for (const item of line.moves) last = chess.move(item.san);
  return { fen: chess.fen(), lastMove: last ? { from: last.from, to: last.to } : undefined };
}
