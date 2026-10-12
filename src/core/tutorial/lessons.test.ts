import { describe, expect, it } from "vitest";
import { isSquare } from "../types";
import { ExerciseBoard } from "./exerciseBoard";
import { getLesson, LESSON_GROUPS, LESSONS } from "./lessons";
import type { MoveGoal } from "./lessons";
import { isGoalMet, movesAllowed } from "./lessonSession";

/**
 * Tries every possible sequence of moves, up to `movesLeft` long, and reports
 * whether at least one of them reaches the goal. This proves an exercise can
 * actually be solved.
 */
function canBeSolved(fen: string, goal: MoveGoal, movesLeft: number): boolean {
  const start = new ExerciseBoard();
  start.load(fen);
  // The learner plays whichever side is to move in the position.
  const learnerSquares = Object.entries(start.getPosition().pieces)
    .filter(([, piece]) => piece.color === start.learnerColor())
    .map(([square]) => square);

  for (const from of learnerSquares) {
    for (const to of start.legalMovesFrom(from)) {
      const board = new ExerciseBoard();
      board.load(fen);
      board.attemptMove(from, to, board.isPromotionMove(from, to) ? "queen" : undefined);
      const position = board.getPosition();
      if (isGoalMet(goal, position, position.lastMove)) return true;
      if (movesLeft > 1 && canBeSolved(position.fen, goal, movesLeft - 1)) return true;
    }
  }
  return false;
}

describe("the lesson list", () => {
  it("starts with the board and all six pieces", () => {
    const basics = LESSONS.filter((lesson) => lesson.group === "basics").map((lesson) => lesson.id);
    expect(basics).toEqual(["board", "rook", "bishop", "queen", "knight", "king", "pawn"]);
    expect(LESSONS.slice(0, 7).map((lesson) => lesson.id)).toEqual(basics);
  });

  it("has lessons in every section of Teacher mode", () => {
    for (const group of LESSON_GROUPS) {
      const count = LESSONS.filter((lesson) => lesson.group === group.id).length;
      expect(count, group.title).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives every lesson its own id", () => {
    const ids = LESSONS.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("looks lessons up by id", () => {
    expect(getLesson("knight")?.title).toBe("The knight");
    expect(getLesson("legals-trap")?.title).toBe("Legal's Trap");
  });

  it("gives every lesson an interactive exercise", () => {
    for (const lesson of LESSONS) {
      const interactive = lesson.steps.filter((step) => step.kind !== "info");
      expect(interactive.length, lesson.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("shows the board from Black's side in lessons where the learner plays Black", () => {
    for (const lesson of LESSONS) {
      const firstMove = lesson.steps.find((step) => step.kind === "move");
      if (!firstMove) continue;
      const board = new ExerciseBoard();
      board.load(firstMove.fen);
      expect(lesson.orientation ?? "white", lesson.id).toBe(board.learnerColor());
    }
  });
});

// One group of checks per lesson, so a broken step is easy to find.
describe.each(LESSONS)("lesson: $title", (lesson) => {
  it("ends on something worth remembering", () => {
    const last = lesson.steps[lesson.steps.length - 1];
    const closing = last.kind === "info" ? last.text : last.success;
    expect(closing.length).toBeGreaterThan(20);
  });

  it.each(lesson.steps.map((step, index) => ({ step, number: index + 1 })))(
    "step $number is well formed",
    ({ step }) => {
      expect(step.text.length).toBeGreaterThan(10);
      for (const square of step.marks ?? []) expect(isSquare(square)).toBe(true);

      // The position must load, and loading it must not throw.
      const board = new ExerciseBoard();
      board.load(step.fen);
      const position = board.getPosition();

      if (step.showMovesOf) {
        expect(position.pieces[step.showMovesOf]?.color).toBe("white");
      }
      if (step.kind === "pick") {
        expect(isSquare(step.answer)).toBe(true);
        expect(step.success.length).toBeGreaterThan(0);
      }
      if (step.kind === "move") {
        expect(step.success.length).toBeGreaterThan(0);
        // The goal must not already be true before the learner moves...
        expect(isGoalMet(step.goal, position, undefined)).toBe(false);
        // ...and there must be a way to reach it in the moves allowed.
        expect(canBeSolved(step.fen, step.goal, movesAllowed(step.goal))).toBe(true);
      }
    },
  );
});
