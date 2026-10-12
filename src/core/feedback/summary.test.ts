import { describe, expect, it } from "vitest";
import type { MistakeTheme, MoveQuality, MoveReview } from "../analysis/moveReview";
import { Game } from "../game/game";
import { summariseGame } from "./summary";

/** Plays a list of moves and returns the final position. */
function play(moves: [string, string][], fen?: string) {
  const game = new Game(fen);
  for (const [from, to] of moves) {
    if (!game.attemptMove(from, to).ok) throw new Error(`illegal test move ${from}-${to}`);
  }
  return game.getPosition();
}

function review(quality: MoveQuality, theme: MistakeTheme | null = null, lossCp = 0, san = "x"): MoveReview {
  return { ply: 0, moveNumber: 1, san, quality, lossCp, theme, explanation: theme ? "why" : null, best: null };
}

const FOOLS_MATE: [string, string][] = [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]];
const SCHOLARS_MATE: [string, string][] = [
  ["e2", "e4"], ["e7", "e5"], ["d1", "h5"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"], ["h5", "f7"],
];

describe("summariseGame: the result", () => {
  it("reports a loss", () => {
    const summary = summariseGame(play(FOOLS_MATE), [], "white");
    expect(summary).toMatchObject({ result: "loss", resultText: "You lost by checkmate.", playerMoves: 2 });
  });

  it("reports a win", () => {
    const summary = summariseGame(play(SCHOLARS_MATE), [], "white");
    expect(summary).toMatchObject({ result: "win", resultText: "You won by checkmate.", playerMoves: 4 });
  });

  it("sees the same game from black's side", () => {
    expect(summariseGame(play(FOOLS_MATE), [], "black").result).toBe("win");
  });

  it("reports a draw and says why", () => {
    const stalemate = new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").getPosition();
    expect(summariseGame(stalemate, [], "white")).toMatchObject({ result: "draw" });
    expect(summariseGame(stalemate, [], "white").resultText).toContain("stalemate");

    const bareKings = new Game("8/8/8/4k3/8/8/8/4K3 w - - 0 1").getPosition();
    expect(summariseGame(bareKings, [], "white").resultText).toContain("enough pieces");
  });
});

describe("summariseGame: counting", () => {
  it("counts captures by each side", () => {
    // 1.e4 d5 2.exd5 Qxd5: one capture each.
    const position = play([["e2", "e4"], ["d7", "d5"], ["e4", "d5"], ["d8", "d5"]]);
    const summary = summariseGame(position, [], "white");
    expect(summary).toMatchObject({ capturesByPlayer: 1, capturesByOpponent: 1, playerMoves: 2 });
  });

  it("groups the reviewed moves and works out the share of good ones", () => {
    const reviews = [
      review("best"),
      review("good"),
      review("inaccuracy", "other", 80),
      review("blunder", "hung-piece", 400),
    ];
    const summary = summariseGame(play(FOOLS_MATE), reviews, "white");
    expect(summary.counts).toEqual({ good: 2, inaccuracy: 1, mistake: 0, blunder: 1 });
    expect(summary.goodMovePercent).toBe(50);
  });

  it("has no percentage when nothing was reviewed", () => {
    expect(summariseGame(play(FOOLS_MATE), [], "white").goodMovePercent).toBeNull();
  });

  it("lists the three worst mistakes, worst first, and leaves out inaccuracies", () => {
    const reviews = [
      review("mistake", "other", 200, "a"),
      review("blunder", "hung-piece", 900, "b"),
      review("inaccuracy", "other", 70, "c"),
      review("blunder", "hung-piece", 500, "d"),
      review("mistake", "other", 160, "e"),
    ];
    const summary = summariseGame(play(FOOLS_MATE), reviews, "white");
    expect(summary.keyMistakes.map((item) => item.san)).toEqual(["b", "d", "a"]);
  });
});

describe("summariseGame: recommendations", () => {
  const lost = play(FOOLS_MATE);
  const won = play(SCHOLARS_MATE);

  it("warns about allowing checkmate", () => {
    const { recommendations } = summariseGame(lost, [review("blunder", "allowed-mate", 1000)], "white");
    expect(recommendations[0]).toContain("most dangerous reply");
  });

  it("gives stronger advice when pieces were hung repeatedly", () => {
    const once = summariseGame(lost, [review("blunder", "hung-piece", 400)], "white").recommendations;
    const twice = summariseGame(
      lost,
      [review("blunder", "hung-piece", 400), review("mistake", "hung-piece", 200)],
      "white",
    ).recommendations;
    expect(once).toEqual(["Before each move, check that none of your pieces can be captured for free."]);
    expect(twice[0]).toContain("more than once");
  });

  it("advises on missed captures and missed mates", () => {
    const advice = summariseGame(
      lost,
      [review("mistake", "missed-capture", 300), review("mistake", "missed-mate", 0)],
      "white",
    ).recommendations.join(" ");
    expect(advice).toContain("every capture");
    expect(advice).toContain("every check");
  });

  it("mentions castling only in a game long enough to have castled", () => {
    expect(summariseGame(lost, [], "white").recommendations.join(" ")).not.toContain("castle");

    // Twelve moves each of shuffling knights, with no castling.
    const shuffle: [string, string][] = [];
    for (let i = 0; i < 6; i++) {
      shuffle.push(["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]);
    }
    const long = new Game();
    // Threefold repetition would end this game early, so add a pawn move each cycle.
    const pawns = ["a", "b", "c", "d", "e", "h"];
    for (let i = 0; i < 6; i++) {
      for (const [from, to] of shuffle.slice(i * 4, i * 4 + 2)) long.attemptMove(from, to);
      long.attemptMove(`${pawns[i]}2`, `${pawns[i]}3`);
      long.attemptMove(`${pawns[i]}7`, `${pawns[i]}6`);
      for (const [from, to] of shuffle.slice(i * 4 + 2, i * 4 + 4)) long.attemptMove(from, to);
    }
    const position = long.getPosition();
    expect(position.history.filter((move) => move.color === "white").length).toBeGreaterThanOrEqual(12);
    expect(summariseGame(position, [], "white").recommendations.join(" ")).toContain("did not castle");
  });

  it("praises a clean win and suggests a harder opponent", () => {
    const { recommendations } = summariseGame(won, [review("best"), review("good")], "white");
    expect(recommendations).toEqual([
      "A clean win with no serious mistakes. You are ready to try a harder opponent.",
    ]);
  });

  it("always gives at least one piece of advice, and never more than three", () => {
    expect(summariseGame(lost, [], "white").recommendations).toHaveLength(1);

    const everything = [
      review("blunder", "allowed-mate", 1000),
      review("mistake", "missed-mate", 0),
      review("blunder", "hung-piece", 400),
      review("mistake", "missed-capture", 300),
    ];
    expect(summariseGame(lost, everything, "white").recommendations).toHaveLength(3);
  });
});
