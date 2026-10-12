import { describe, expect, it } from "vitest";
import { isSquare } from "../types";
import { ExerciseBoard } from "./exerciseBoard";
import { getLesson, LESSONS } from "./lessons";
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
  const whiteSquares = Object.entries(start.getPosition().pieces)
    .filter(([, piece]) => piece.color === "white")
    .map(([square]) => square);

  for (const from of whiteSquares) {
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
  it("covers the board and all six pieces", () => {
    expect(LESSONS.map((lesson) => lesson.id)).toEqual([
      "board",
      "rook",
      "bishop",
      "queen",
      "knight",
      "king",
      "pawn",
    ]);
  });

  it("looks lessons up by id", () => {
    expect(getLesson("knight")?.title).toBe("The knight");
  });

  it("gives every lesson an interactive exercise", () => {
    for (const lesson of LESSONS) {
      const interactive = lesson.steps.filter((step) => step.kind !== "info");
      expect(interactive.length, lesson.id).toBeGreaterThanOrEqual(2);
    }
  });
});

// One group of checks per lesson, so a broken step is easy to find.
describe.each(LESSONS)("lesson: $title", (lesson) => {
  it("starts with an explanation", () => {
    expect(lesson.steps[0].kind).toBe("info");
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
