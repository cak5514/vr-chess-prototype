import { describe, expect, it } from "vitest";
import { reviewMove } from "../analysis/moveReview";
import type { MoveReview } from "../analysis/moveReview";
import type { EngineLine } from "../engine/engine";
import type { IdeaLabel } from "../model/moveClassifier";
import type { MoveChoice } from "../types";
import { commentOn } from "./comment";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function line(move: MoveChoice, score: { cp?: number; mate?: number }): EngineLine {
  return { move, pv: [move], scoreCp: score.cp, mateIn: score.mate };
}

/** Builds a review the same way the game does, then adds the model's ideas. */
function review(
  fen: string,
  san: string,
  played: MoveChoice,
  best: MoveChoice,
  scores: { best: number; afterForOpponent?: number },
  ideas: IdeaLabel[] = [],
): MoveReview {
  const result = reviewMove({
    ply: 0,
    san,
    fenBefore: fen,
    played,
    bestLine: line(best, { cp: scores.best }),
    replyLine:
      scores.afterForOpponent === undefined ? undefined : line({ from: "a7", to: "a6" }, { cp: scores.afterForOpponent }),
  });
  result.ideas = ideas;
  return result;
}

describe("commentOn: good moves", () => {
  it("rates the engine's choice as the best move and says what it does", () => {
    const e4 = { from: "e2", to: "e4" };
    const comment = commentOn(review(START, "e4", e4, e4, { best: 30 }));
    expect(comment).toMatchObject({ rating: "best", ratingLabel: "Best move", san: "e4", moveNumber: 1 });
    expect(comment.text[0]).toBe("It puts a pawn on e4, which controls d5 and f5 and claims space in the centre.");
  });

  it("rates a slightly different move as good", () => {
    const comment = commentOn(
      review(START, "Nf3", { from: "g1", to: "f3" }, { from: "e2", to: "e4" }, { best: 30, afterForOpponent: -20 }),
    );
    expect(comment.rating).toBe("good");
    expect(comment.text).toEqual(["From f3 your knight controls the centre squares d4 and e5."]);
  });

  it("still says something when no rule describes the move", () => {
    const fen = "3qk3/8/8/8/8/8/8/3QK3 w - - 0 1";
    const kf1 = { from: "e1", to: "f1" };
    expect(commentOn(review(fen, "Kf1", kf1, kf1, { best: 0 })).text).toEqual([
      "This is the move the engine would have played. It keeps your position as strong as possible.",
    ]);
    expect(
      commentOn(review(fen, "Kf1", kf1, { from: "d1", to: "d2" }, { best: 0, afterForOpponent: 10 })).text,
    ).toEqual(["A solid, sensible move. Nothing is lost and your position stays healthy."]);
  });
});

describe("commentOn: ideas from the trained model", () => {
  // A quiet king move, so the rules have little to say and the model's idea shows clearly.
  const fen = "3qk3/8/8/8/8/8/8/3QK3 w - - 0 1";
  const move = { from: "e1", to: "f1" };

  it("names an idea the model found and explains it", () => {
    const comment = commentOn(review(fen, "Kf1", move, move, { best: 0 }, ["pin"]));
    expect(comment.ideas).toEqual(["Pin"]);
    expect(comment.text[0]).toContain("This is a pin");
  });

  it("does not repeat an idea the rules already explained", () => {
    // The knight fork: the rules describe it, and the model also says "fork".
    const forkFen = "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1";
    const nc7 = { from: "d5", to: "c7" };
    const comment = commentOn(review(forkFen, "Nc7+", nc7, nc7, { best: 500 }, ["fork"]));
    expect(comment.ideas).toEqual(["Fork"]);
    expect(comment.text.filter((sentence) => sentence.toLowerCase().includes("fork"))).toHaveLength(1);
  });

  it("ignores a 'mate' label when the move is not checkmate", () => {
    const comment = commentOn(review(fen, "Kf1", move, move, { best: 0 }, ["mate"]));
    expect(comment.ideas).toEqual([]);
  });

  it("accepts a 'mate' label when the move really is checkmate", () => {
    const mateFen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    const qxf7 = { from: "h5", to: "f7" };
    const comment = commentOn(review(mateFen, "Qxf7#", qxf7, qxf7, { best: 1000 }, ["mate"]));
    expect(comment.ideas).toEqual(["Checkmate"]);
  });

  it("leaves out labels too vague to explain", () => {
    const comment = commentOn(review(fen, "Kf1", move, move, { best: 0 }, ["quietMove", "defensiveMove"]));
    expect(comment.ideas).toEqual([]);
  });

  it("does not decorate a bad move with ideas", () => {
    const bad = review(fen, "Kf1", move, { from: "d1", to: "d8" }, { best: 900, afterForOpponent: 0 }, ["fork"]);
    expect(commentOn(bad).ideas).toEqual([]);
  });
});

describe("commentOn: sacrifice or blunder", () => {
  // White's knight steps to e5, where the d6 pawn can capture it.
  const fen = "4k3/8/3p4/8/8/5N2/8/4K3 w - - 0 1";
  const ne5 = { from: "f3", to: "e5" };

  it("calls giving up a piece a sacrifice when the engine says it works", () => {
    const comment = commentOn(review(fen, "Ne5", ne5, ne5, { best: 300 }));
    expect(comment).toMatchObject({ rating: "sacrifice", ratingLabel: "Sacrifice!" });
    expect(comment.text[0]).toBe(
      "You gave up your knight on e5 on purpose, and it works: you get more back than you lose.",
    );
  });

  it("calls the very same move a blunder when the engine says it fails", () => {
    const comment = commentOn(review(fen, "Ne5", ne5, { from: "f3", to: "d4" }, { best: 200, afterForOpponent: 150 }));
    expect(comment.rating).toBe("blunder");
    expect(comment.text[0]).toContain("This left your knight on e5 attacked by the pawn on d6");
    expect(comment.text[1]).toBe(
      "A sacrifice gives up material to gain something bigger. Here your knight is simply lost, with nothing in return.",
    );
  });

  it("accepts a sacrifice the model recognised even if the rules did not", () => {
    const e4 = { from: "e2", to: "e4" };
    const comment = commentOn(review(START, "e4", e4, e4, { best: 30 }, ["sacrifice"]));
    expect(comment.rating).toBe("sacrifice");
    expect(comment.text[0]).toContain("You gave up material on purpose");
  });

  it("does not call an even trade a sacrifice", () => {
    // Knight takes a knight that a pawn defends: three points for three.
    const tradeFen = "4k3/3p4/4n3/8/3N4/8/8/4K3 w - - 0 1";
    const nxe6 = { from: "d4", to: "e6" };
    expect(commentOn(review(tradeFen, "Nxe6", nxe6, nxe6, { best: 0 })).rating).toBe("best");
  });
});

describe("commentOn: mistakes", () => {
  it("passes on the review's explanation for an inaccuracy or mistake", () => {
    const fen = "4k3/pp3ppp/8/8/8/8/PP3PPP/R3K3 w - - 0 1";
    const comment = commentOn(
      review(fen, "a3", { from: "a2", to: "a3" }, { from: "a1", to: "d1" }, { best: 120, afterForOpponent: -30 }),
    );
    expect(comment).toMatchObject({ rating: "inaccuracy", ratingLabel: "Inaccuracy" });
    expect(comment.text).toEqual([
      "A better move was rook to d1. It puts your rook on the open d-file, where no pawns block its path.",
    ]);
  });
});
