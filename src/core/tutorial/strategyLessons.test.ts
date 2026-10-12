import { Chess } from "chess.js";
import type { Square as ChessJsSquare } from "chess.js";
import { describe, expect, it } from "vitest";
import { getLesson } from "./lessons";
import type { LessonId, MoveStep } from "./lessons";
import { finalPosition, lineSteps } from "./lineBuilder";
import type { Line } from "./lineBuilder";

// The strategy lessons make chess claims: "this is a fork", "this is
// checkmate", "the knight cannot move". These tests check each claim against
// the rules of chess, so a lesson cannot teach something that is not true.

/** The "move" steps of a lesson, in order. */
function moveSteps(id: LessonId): MoveStep[] {
  return getLesson(id)!.steps.filter((step): step is MoveStep => step.kind === "move");
}

/** Plays a step's answer and returns the board afterwards. */
function afterAnswer(step: MoveStep): Chess {
  if (step.goal.type !== "play") throw new Error("not a play step");
  const chess = new Chess(step.fen);
  chess.move({ from: step.goal.from, to: step.goal.to });
  return chess;
}

/** True if the piece on `from` attacks `target`. */
function attacks(chess: Chess, from: string, target: string): boolean {
  const piece = chess.get(from as ChessJsSquare)!;
  return chess.attackers(target as ChessJsSquare, piece.color).includes(from as ChessJsSquare);
}

describe("lineBuilder", () => {
  const line: Line = {
    learner: "white",
    moves: [
      { san: "e4", ask: "Play e4.", why: "Centre." },
      { san: "e5", note: "Black copies." },
      { san: "Nf3", ask: "Play Nf3.", why: "Develops." },
    ],
  };

  it("makes one step for each of the learner's moves", () => {
    const steps = lineSteps(line);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ kind: "move", goal: { type: "play", from: "e2", to: "e4" }, success: "Centre." });
  });

  it("starts each step from the position after the opponent's reply, and says what it was", () => {
    const second = lineSteps(line)[1];
    expect(second.fen).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    expect(second.text).toBe("Black plays pawn to e5. Black copies. Play Nf3.");
    expect(second.shownMove).toEqual({ from: "e7", to: "e5" });
  });

  it("reports the final position", () => {
    expect(finalPosition(line).lastMove).toEqual({ from: "g1", to: "f3" });
  });

  it("refuses an illegal move", () => {
    const bad: Line = { learner: "white", moves: [{ san: "e5", ask: "", why: "" }] };
    expect(() => lineSteps(bad)).toThrow(/not a legal move/);
  });

  it("refuses notation that hides a check or checkmate", () => {
    // Qxf7 here is checkmate, so it must be written "Qxf7#".
    const bad: Line = {
      learner: "white",
      startFen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
      moves: [{ san: "Qxf7", ask: "", why: "" }],
    };
    expect(() => lineSteps(bad)).toThrow(/should be written "Qxf7#"/);
  });

  it("refuses a line where the wrong side is asked to move", () => {
    const bad: Line = { learner: "black", moves: [{ san: "e4", ask: "", why: "" }] };
    expect(() => lineSteps(bad)).toThrow(/not the learner's move/);
  });
});

describe("tactics lessons teach real tactics", () => {
  it("fork: each answer attacks both of the pieces it claims to", () => {
    const [knight, pawn, queen] = moveSteps("fork").map(afterAnswer);
    expect(attacks(knight, "c7", "e8") && attacks(knight, "c7", "a8")).toBe(true);
    expect(attacks(pawn, "d5", "c6") && attacks(pawn, "d5", "e6")).toBe(true);
    expect(attacks(queen, "h5", "e8") && attacks(queen, "h5", "a5")).toBe(true);
    // The forked pieces cannot simply capture the forking piece.
    expect(knight.moves({ verbose: true }).some((move) => move.to === "c7")).toBe(false);
    expect(pawn.moves({ verbose: true }).some((move) => move.to === "d5")).toBe(false);
    expect(queen.moves({ verbose: true }).some((move) => move.to === "h5")).toBe(false);
  });

  it("pin: the pinned knight has no legal move", () => {
    const [pinned, attackedAgain] = moveSteps("pin").map(afterAnswer);
    expect(pinned.moves({ square: "c6" })).toEqual([]);
    expect(attackedAgain.moves({ square: "c6" })).toEqual([]);
    expect(attacks(attackedAgain, "d5", "c6")).toBe(true);
  });

  it("skewer: the answer is check, and the piece behind the king is then attacked", () => {
    const [rook, bishop] = moveSteps("skewer").map(afterAnswer);
    for (const [chess, attacker, prize] of [[rook, "a5", "h5"], [bishop, "b2", "h8"]] as const) {
      expect(chess.inCheck()).toBe(true);
      // Whatever the king does, the piece behind him can be captured next.
      for (const reply of chess.moves({ verbose: true })) {
        const next = new Chess(reply.after);
        expect(attacks(next, attacker, prize), `${reply.san}`).toBe(true);
      }
    }
  });

  it("discovered attack: every accepted answer checks the king and uncovers the rook", () => {
    const [step] = moveSteps("discovered-attack");
    if (step.goal.type !== "play") throw new Error("not a play step");
    for (const answer of [step.goal, ...(step.goal.or ?? [])]) {
      const chess = new Chess(step.fen);
      chess.move({ from: answer.from, to: answer.to });
      expect(chess.inCheck()).toBe(true);
      expect(attacks(chess, "e1", "e8")).toBe(true);
      // Black cannot capture the knight or the rook to escape.
      expect(chess.moves({ verbose: true }).every((move) => move.piece === "k")).toBe(true);
    }
  });
});

describe("checkmate lessons", () => {
  it.each(["back-rank-mate", "queen-mate", "rook-mate"] as const)("%s: every puzzle has a mate in one", (id) => {
    for (const step of moveSteps(id)) {
      expect(step.goal.type).toBe("checkmate");
      const chess = new Chess(step.fen);
      const mates = chess.moves().filter((san) => san.endsWith("#"));
      expect(mates.length, step.fen).toBeGreaterThanOrEqual(1);
    }
  });

  it("queen-mate: the stalemate example really is stalemate", () => {
    const example = getLesson("queen-mate")!.steps.find((step) => step.text.includes("stalemate, and"))!;
    expect(new Chess(example.fen).isStalemate()).toBe(true);
  });
});

describe("opening and gambit lessons end where they say they do", () => {
  function finalBoard(id: LessonId): Chess {
    const steps = getLesson(id)!.steps;
    return new Chess(steps[steps.length - 1].fen);
  }

  it("Italian Game: White has castled and developed", () => {
    const chess = finalBoard("italian-game");
    expect(chess.get("g1")).toMatchObject({ type: "k", color: "w" });
    expect(chess.get("c4")).toMatchObject({ type: "b", color: "w" });
    expect(chess.get("f3")).toMatchObject({ type: "n", color: "w" });
  });

  it("Playing Black: Black has castled", () => {
    expect(finalBoard("ruy-lopez-black").get("g8")).toMatchObject({ type: "k", color: "b" });
  });

  it("Queen's Gambit: the queen attacks the rook in the corner", () => {
    const chess = finalBoard("queens-gambit");
    expect(attacks(chess, "f3", "a8")).toBe(true);
  });

  it("King's Gambit: White is a pawn down and has castled", () => {
    const chess = finalBoard("kings-gambit");
    const pawns = (color: "w" | "b") => chess.findPiece({ type: "p", color }).length;
    expect(pawns("b") - pawns("w")).toBe(1);
    expect(chess.get("g1")).toMatchObject({ type: "k", color: "w" });
  });

  it("Scholar's Mate: White has no checkmate left", () => {
    const chess = finalBoard("scholars-mate");
    expect(chess.moves().some((san) => san.endsWith("#"))).toBe(false);
  });

  it("Legal's Trap: it ends in checkmate, with White a queen down", () => {
    const chess = finalBoard("legals-trap");
    expect(chess.isCheckmate()).toBe(true);
    expect(chess.findPiece({ type: "q", color: "w" })).toEqual([]);
    expect(chess.findPiece({ type: "q", color: "b" })).toHaveLength(1);
  });
});
