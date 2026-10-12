import { describe, expect, it } from "vitest";
import type { EngineLine } from "../engine/engine";
import type { MoveChoice } from "../types";
import { classify, reviewMove, scoreOf } from "./moveReview";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function line(move: MoveChoice, score: { cp?: number; mate?: number }): EngineLine {
  return { move, pv: [move], scoreCp: score.cp, mateIn: score.mate };
}

describe("scoreOf", () => {
  it("reads centipawns and caps them at ten pawns", () => {
    const move = { from: "e2", to: "e4" };
    expect(scoreOf(line(move, { cp: 35 }))).toBe(35);
    expect(scoreOf(line(move, { cp: 2500 }))).toBe(1000);
    expect(scoreOf(line(move, { cp: -4000 }))).toBe(-1000);
  });

  it("treats a forced mate as the best or worst possible score", () => {
    const move = { from: "e2", to: "e4" };
    expect(scoreOf(line(move, { mate: 3 }))).toBe(1000);
    expect(scoreOf(line(move, { mate: -2 }))).toBe(-1000);
  });

  it("is zero when there is no line", () => {
    expect(scoreOf(undefined)).toBe(0);
  });
});

describe("classify", () => {
  it("labels moves by how much they lose", () => {
    expect(classify(0)).toBe("good");
    expect(classify(59)).toBe("good");
    expect(classify(60)).toBe("inaccuracy");
    expect(classify(150)).toBe("mistake");
    expect(classify(300)).toBe("blunder");
    expect(classify(900)).toBe("blunder");
  });
});

describe("reviewMove: fine moves", () => {
  it("calls the engine's own choice the best move", () => {
    const review = reviewMove({
      ply: 0,
      san: "e4",
      fenBefore: START,
      played: { from: "e2", to: "e4" },
      bestLine: line({ from: "e2", to: "e4" }, { cp: 30 }),
    });
    expect(review).toMatchObject({ quality: "best", lossCp: 0, theme: null, explanation: null, moveNumber: 1 });
  });

  it("calls a slightly different move good", () => {
    const review = reviewMove({
      ply: 0,
      san: "d4",
      fenBefore: START,
      played: { from: "d2", to: "d4" },
      bestLine: line({ from: "e2", to: "e4" }, { cp: 30 }),
      // The opponent is 10 behind after d4, so we are 10 ahead: a loss of 20.
      replyLine: line({ from: "d7", to: "d5" }, { cp: -10 }),
    });
    expect(review).toMatchObject({ quality: "good", lossCp: 20, explanation: null });
  });

  it("calls delivering checkmate the best move", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    const review = reviewMove({
      ply: 6,
      san: "Qxf7#",
      fenBefore: fen,
      played: { from: "h5", to: "f7" },
      bestLine: line({ from: "h5", to: "f7" }, { mate: 1 }),
    });
    expect(review).toMatchObject({ quality: "best", moveNumber: 4 });
  });

  it("numbers black's moves correctly", () => {
    const review = reviewMove({
      ply: 3,
      san: "Nc6",
      fenBefore: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
      played: { from: "b8", to: "c6" },
      bestLine: line({ from: "b8", to: "c6" }, { cp: 0 }),
    });
    expect(review.moveNumber).toBe(2);
  });
});

describe("reviewMove: mistakes", () => {
  it("spots a piece left hanging", () => {
    // White plays Nf3-e5??, where the d6 pawn can take the knight for free.
    const fen = "4k3/8/3p4/8/8/5N2/8/4K3 w - - 0 1";
    const review = reviewMove({
      ply: 0,
      san: "Ne5",
      fenBefore: fen,
      played: { from: "f3", to: "e5" },
      bestLine: line({ from: "f3", to: "d4" }, { cp: 200 }),
      replyLine: line({ from: "d6", to: "e5" }, { cp: 150 }),
    });
    expect(review).toMatchObject({ quality: "blunder", lossCp: 350, theme: "hung-piece" });
    expect(review.explanation).toBe(
      "This left your knight on e5 attacked by the pawn on d6, with nothing defending it. A better move was knight to d4.",
    );
  });

  it("spots a threat that was ignored", () => {
    // The knight on e5 is already attacked; white plays a king move instead of saving it.
    const fen = "4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1";
    const review = reviewMove({
      ply: 0,
      san: "Kd1",
      fenBefore: fen,
      played: { from: "e1", to: "d1" },
      bestLine: line({ from: "e5", to: "f3" }, { cp: 200 }),
      replyLine: line({ from: "d6", to: "e5" }, { cp: 150 }),
    });
    expect(review.theme).toBe("hung-piece");
    expect(review.explanation).toContain("was under attack by the pawn on d6, and this move did not deal with it");
  });

  it("spots a missed free capture", () => {
    // The black knight on e5 is undefended, but white plays a quiet king move.
    const fen = "4k3/8/8/4n3/8/8/8/4RK2 w - - 0 1";
    const review = reviewMove({
      ply: 0,
      san: "Kg1",
      fenBefore: fen,
      played: { from: "f1", to: "g1" },
      bestLine: line({ from: "e1", to: "e5" }, { cp: 500 }),
      replyLine: line({ from: "e5", to: "c6" }, { cp: -200 }),
    });
    expect(review).toMatchObject({ quality: "blunder", theme: "missed-capture" });
    expect(review.explanation).toBe("You could have won a knight: rook takes the knight on e5.");
  });

  it("spots a missed checkmate in one, even when still winning", () => {
    const fen = "6k1/5ppp/8/8/8/8/8/3QR1K1 w - - 0 1";
    const review = reviewMove({
      ply: 0,
      san: "Qd2",
      fenBefore: fen,
      played: { from: "d1", to: "d2" },
      bestLine: line({ from: "e1", to: "e8" }, { mate: 1 }),
      replyLine: line({ from: "h7", to: "h6" }, { cp: -1500 }),
    });
    expect(review).toMatchObject({ quality: "mistake", theme: "missed-mate" });
    expect(review.explanation).toBe("You had checkmate in one move: rook to e8.");
  });

  it("spots a move that allows checkmate", () => {
    // Fool's mate: 2.g4 lets black play Qh4#.
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2";
    const review = reviewMove({
      ply: 2,
      san: "g4",
      fenBefore: fen,
      played: { from: "g2", to: "g4" },
      bestLine: line({ from: "e2", to: "e4" }, { cp: -40 }),
      replyLine: line({ from: "d8", to: "h4" }, { mate: 1 }),
    });
    expect(review).toMatchObject({ quality: "blunder", theme: "allowed-mate", moveNumber: 2 });
    expect(review.explanation).toBe(
      "This lets your opponent force checkmate on the next move. A better move was pawn to e4.",
    );
  });

  it("falls back on what the better move would have done", () => {
    // Nothing is hanging; the engine simply prefers bringing the rook to the open file.
    const fen = "4k3/pp3ppp/8/8/8/8/PP3PPP/R3K3 w - - 0 1";
    const review = reviewMove({
      ply: 0,
      san: "a3",
      fenBefore: fen,
      played: { from: "a2", to: "a3" },
      bestLine: line({ from: "a1", to: "d1" }, { cp: 120 }),
      replyLine: line({ from: "e8", to: "e7" }, { cp: -30 }),
    });
    expect(review).toMatchObject({ quality: "inaccuracy", theme: "other" });
    expect(review.explanation).toBe(
      "A better move was rook to d1. It puts your rook on the open d-file, where no pawns block its path.",
    );
  });

  it("does not punish a move in a position that was already decided", () => {
    // +25 pawns before, +15 after: both are capped, so no loss is recorded.
    const review = reviewMove({
      ply: 0,
      san: "a3",
      fenBefore: START,
      played: { from: "a2", to: "a3" },
      bestLine: line({ from: "e2", to: "e4" }, { cp: 2500 }),
      replyLine: line({ from: "e7", to: "e5" }, { cp: -1500 }),
    });
    expect(review).toMatchObject({ quality: "good", lossCp: 0 });
  });
});
