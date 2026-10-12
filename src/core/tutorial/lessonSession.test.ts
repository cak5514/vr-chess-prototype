import { describe, expect, it, vi } from "vitest";
import type { Lesson } from "./lessons";
import { getLesson } from "./lessons";
import { isGoalMet, LessonSession, movesAllowed } from "./lessonSession";

const ROOK = "8/8/8/8/3R4/8/8/8 w - - 0 1";

/** A tiny lesson with one step of each kind, so the tests do not depend on real content. */
const SAMPLE: Lesson = {
  id: "rook",
  group: "basics",
  title: "Sample",
  summary: "For tests",
  steps: [
    { kind: "info", fen: ROOK, showMovesOf: "d4", text: "Read this." },
    { kind: "pick", fen: ROOK, answer: "e4", text: "Click e4.", success: "Yes." },
    { kind: "move", fen: ROOK, goal: { type: "reach", square: "d8" }, text: "Go to d8.", success: "Done." },
    {
      kind: "move",
      fen: "8/8/8/p3p3/8/8/8/R7 w - - 0 1",
      goal: { type: "capture-all", maxMoves: 2 },
      text: "Take both.",
      success: "Both taken.",
    },
  ],
};

describe("goals", () => {
  it("allows one move unless the goal says otherwise", () => {
    expect(movesAllowed({ type: "reach", square: "d8" })).toBe(1);
    expect(movesAllowed({ type: "capture-all", maxMoves: 2 })).toBe(2);
    expect(movesAllowed({ type: "any" })).toBe(1);
  });

  it("checks each kind of goal", () => {
    const session = new LessonSession(SAMPLE);
    const start = session.board.getPosition();
    expect(isGoalMet({ type: "reach", square: "d4" }, start, undefined)).toBe(true);
    expect(isGoalMet({ type: "reach", square: "d8" }, start, undefined)).toBe(false);
    expect(isGoalMet({ type: "capture-all" }, start, undefined)).toBe(true); // no black pieces
    expect(isGoalMet({ type: "any" }, start, undefined)).toBe(false); // nothing played yet

    const move = { from: "e1", to: "g1", color: "white", piece: "king", san: "O-O", isCastle: true, isEnPassant: false, fenBefore: "", fenAfter: "" } as const;
    expect(isGoalMet({ type: "play", from: "e1", to: "g1" }, start, move)).toBe(true);
    expect(isGoalMet({ type: "play", from: "e1", to: "f1" }, start, move)).toBe(false);
    expect(isGoalMet({ type: "promote" }, start, move)).toBe(false);
    expect(isGoalMet({ type: "promote" }, start, { ...move, promotion: "queen" })).toBe(true);
  });
});

describe("LessonSession: info steps", () => {
  it("can be passed straight away and shows where the piece moves", () => {
    const session = new LessonSession(SAMPLE);
    const view = session.getView();
    expect(view).toMatchObject({ stepNumber: 1, stepCount: 4, solved: true, movesLeft: null });
    expect(view.marks).toHaveLength(14);
    // Nothing can be moved while reading.
    expect(session.board.attemptMove("d4", "d8")).toMatchObject({ ok: false });
  });
});

describe("LessonSession: pick steps", () => {
  function atPickStep(): LessonSession {
    const session = new LessonSession(SAMPLE);
    session.next();
    return session;
  }

  it("cannot be skipped", () => {
    const session = atPickStep();
    expect(session.next()).toBe(false);
    expect(session.getView().stepNumber).toBe(2);
  });

  it("explains a wrong answer and lets the learner try again", () => {
    const session = atPickStep();
    session.pickSquare("c3");
    expect(session.getView()).toMatchObject({ solved: false, feedback: { kind: "retry" } });
    expect(session.getView().feedback!.text).toContain("c3");
  });

  it("accepts the right answer", () => {
    const session = atPickStep();
    session.pickSquare("e4");
    expect(session.getView()).toMatchObject({ solved: true, feedback: { kind: "success", text: "Yes." } });
    expect(session.next()).toBe(true);
  });
});

describe("LessonSession: move steps", () => {
  function atMoveStep(): LessonSession {
    const session = new LessonSession(SAMPLE);
    session.next();
    session.pickSquare("e4");
    session.next();
    return session;
  }

  it("highlights the target and counts the moves left", () => {
    const view = atMoveStep().getView();
    expect(view).toMatchObject({ stepNumber: 3, solved: false, movesLeft: 1, marks: ["d8"] });
  });

  it("is solved by the right move, and then locks the board", () => {
    const session = atMoveStep();
    session.board.attemptMove("d4", "d8");
    expect(session.getView()).toMatchObject({ solved: true, feedback: { kind: "success", text: "Done." } });
    expect(session.board.attemptMove("d8", "d1")).toMatchObject({ ok: false });
  });

  it("puts the pieces back after a wrong move", () => {
    const session = atMoveStep();
    session.board.attemptMove("d4", "a4");
    const view = session.getView();
    expect(view).toMatchObject({ solved: false, movesLeft: 1, feedback: { kind: "retry" } });
    expect(session.board.getPosition().pieces["d4"]).toEqual({ type: "rook", color: "white" });
    // And the learner can try again.
    session.board.attemptMove("d4", "d8");
    expect(session.getView().solved).toBe(true);
  });

  it("allows several moves when the goal needs them", () => {
    const session = atMoveStep();
    session.board.attemptMove("d4", "d8");
    session.next();

    session.board.attemptMove("a1", "a5");
    expect(session.getView()).toMatchObject({ solved: false, movesLeft: 1, feedback: null });
    session.board.attemptMove("a5", "e5");
    expect(session.getView()).toMatchObject({ solved: true, feedback: { text: "Both taken." } });
  });

  it("resets when the moves run out", () => {
    const session = atMoveStep();
    session.board.attemptMove("d4", "d8");
    session.next();

    session.board.attemptMove("a1", "a5");
    session.board.attemptMove("a5", "a8"); // misses the second pawn
    expect(session.getView()).toMatchObject({ solved: false, movesLeft: 2, feedback: { kind: "retry" } });
    expect(session.board.getPosition().pieces["a5"]).toEqual({ type: "pawn", color: "black" });
  });

  it("can restart a step on request", () => {
    const session = atMoveStep();
    session.board.attemptMove("d4", "d8");
    session.next();
    session.board.attemptMove("a1", "a5");
    session.restartStep();
    expect(session.getView()).toMatchObject({ movesLeft: 2, feedback: null });
    expect(session.board.getPosition().pieces["a1"]).toEqual({ type: "rook", color: "white" });
  });
});

describe("LessonSession: going back", () => {
  it("cannot go back from the first step", () => {
    const session = new LessonSession(SAMPLE);
    expect(session.getView().canGoBack).toBe(false);
    expect(session.back()).toBe(false);
    expect(session.getView().stepNumber).toBe(1);
  });

  it("returns to the previous step", () => {
    const session = new LessonSession(SAMPLE);
    session.next();
    expect(session.getView().canGoBack).toBe(true);
    expect(session.back()).toBe(true);
    expect(session.getView().stepNumber).toBe(1);
  });

  it("lets the learner skip forward again without re-solving a step they passed", () => {
    const session = new LessonSession(SAMPLE);
    session.next();
    session.pickSquare("e4");
    session.next(); // now on step 3
    session.back(); // back on the pick step

    const view = session.getView();
    expect(view).toMatchObject({ stepNumber: 2, solved: false, canGoNext: true, feedback: null });
    expect(session.next()).toBe(true);
    expect(session.getView().stepNumber).toBe(3);
  });

  it("lets the learner practise an earlier exercise again", () => {
    const session = new LessonSession(SAMPLE);
    session.next();
    session.pickSquare("e4");
    session.next();
    session.board.attemptMove("d4", "d8");
    session.next(); // step 4
    session.back(); // step 3, pieces reset

    expect(session.board.getPosition().pieces["d4"]).toEqual({ type: "rook", color: "white" });
    session.board.attemptMove("d4", "d8");
    expect(session.getView()).toMatchObject({ solved: true, feedback: { kind: "success" } });
  });

  it("still requires the furthest step to be solved", () => {
    const session = new LessonSession(SAMPLE);
    session.next();
    session.back();
    session.next(); // step 2 again: never solved, so it cannot be skipped
    expect(session.getView()).toMatchObject({ stepNumber: 2, canGoNext: false });
    expect(session.next()).toBe(false);
  });
});

describe("LessonSession: finishing", () => {
  it("is complete after the last step", () => {
    const session = new LessonSession(SAMPLE);
    session.next();
    session.pickSquare("e4");
    session.next();
    session.board.attemptMove("d4", "d8");
    session.next();
    session.board.attemptMove("a1", "a5");
    session.board.attemptMove("a5", "e5");

    expect(session.getView().complete).toBe(false);
    expect(session.next()).toBe(true);
    expect(session.getView().complete).toBe(true);
    expect(session.next()).toBe(false);
  });

  it("tells listeners when something changes", () => {
    const session = new LessonSession(SAMPLE);
    const listener = vi.fn();
    const stop = session.onChange(listener);
    session.next();
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    stop();
    session.pickSquare("e4");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("the real lessons", () => {
  it("can be played through from start to finish", () => {
    // The king lesson has every kind of step, including check and castling.
    const session = new LessonSession(getLesson("king")!);
    session.next(); // how the king moves
    session.board.attemptMove("d4", "e5");
    session.next();
    session.next(); // squares the king cannot enter
    session.board.attemptMove("e1", "d1"); // step out of check
    session.next();
    session.board.attemptMove("e1", "g1"); // castle
    expect(session.getView().solved).toBe(true);
    session.next();
    expect(session.getView().complete).toBe(true);
  });
});
