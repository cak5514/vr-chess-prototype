import { describe, expect, it } from "vitest";
import { parseBestMove, parseInfo, parseUciMove } from "./uci";

describe("parseUciMove", () => {
  it("reads a normal move", () => {
    expect(parseUciMove("e2e4")).toEqual({ from: "e2", to: "e4", promotion: undefined });
  });

  it("reads a promotion", () => {
    expect(parseUciMove("e7e8q")).toEqual({ from: "e7", to: "e8", promotion: "queen" });
    expect(parseUciMove("a2a1n")).toEqual({ from: "a2", to: "a1", promotion: "knight" });
  });

  it("rejects text that is not a move", () => {
    expect(parseUciMove("(none)")).toBeNull();
    expect(parseUciMove("e2e9")).toBeNull();
    expect(parseUciMove("")).toBeNull();
  });
});

describe("parseBestMove", () => {
  it("reads the chosen move", () => {
    expect(parseBestMove("bestmove g1f3 ponder d7d5")).toMatchObject({ from: "g1", to: "f3" });
  });

  it("returns null when the engine has no move", () => {
    expect(parseBestMove("bestmove (none)")).toBeNull();
  });

  it("returns undefined for other lines", () => {
    expect(parseBestMove("info depth 3 score cp 10 pv e2e4")).toBeUndefined();
    expect(parseBestMove("readyok")).toBeUndefined();
  });
});

describe("parseInfo", () => {
  it("reads depth, rank, score and first move", () => {
    const line =
      "info depth 8 seldepth 11 multipv 2 score cp -31 nodes 9120 nps 91200 time 100 pv d2d4 d7d5 c2c4";
    expect(parseInfo(line)).toEqual({
      depth: 8,
      rank: 2,
      move: { from: "d2", to: "d4", promotion: undefined },
      pv: [
        { from: "d2", to: "d4", promotion: undefined },
        { from: "d7", to: "d5", promotion: undefined },
        { from: "c2", to: "c4", promotion: undefined },
      ],
      scoreCp: -31,
      mateIn: undefined,
    });
  });

  it("reads a forced mate", () => {
    const info = parseInfo("info depth 5 score mate 2 pv h5f7");
    expect(info).toMatchObject({ rank: 1, mateIn: 2, scoreCp: undefined });
  });

  it("ignores lines without a candidate move", () => {
    expect(parseInfo("info depth 5 currmove e2e4 currmovenumber 1")).toBeNull();
    expect(parseInfo("info string NNUE evaluation enabled")).toBeNull();
    expect(parseInfo("info depth 9 score cp 20 lowerbound pv e2e4")).toBeNull();
    expect(parseInfo("bestmove e2e4")).toBeNull();
  });
});
