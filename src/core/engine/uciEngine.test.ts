import { describe, expect, it } from "vitest";
import { FakeTransport, scriptedTransport } from "./fakeTransport";
import { UciEngine } from "./uciEngine";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("UciEngine", () => {
  it("does the handshake, then sends the search commands in order", async () => {
    const transport = scriptedTransport(["bestmove e2e4"]);
    const engine = new UciEngine(transport);

    await engine.analyse({ fen: START, depth: 5, skillLevel: 3, lines: 2 });

    expect(transport.sent).toEqual([
      "uci",
      "isready",
      "setoption name Skill Level value 3",
      "setoption name MultiPV value 2",
      `position fen ${START}`,
      "go depth 5",
    ]);
  });

  it("returns the chosen move and the candidates, best first", async () => {
    const transport = scriptedTransport([
      "info depth 1 multipv 1 score cp 10 pv g1f3",
      "info depth 2 multipv 2 score cp 20 pv d2d4 d7d5",
      // A deeper report replaces the earlier one for the same rank.
      "info depth 2 multipv 1 score cp 35 pv e2e4 e7e5",
      "bestmove e2e4 ponder e7e5",
    ]);
    const result = await new UciEngine(transport).analyse({ fen: START, depth: 2, lines: 2 });

    expect(result.bestMove).toMatchObject({ from: "e2", to: "e4" });
    expect(result.lines).toMatchObject([
      { move: { from: "e2", to: "e4" }, scoreCp: 35 },
      { move: { from: "d2", to: "d4" }, scoreCp: 20 },
    ]);
    // Each line also carries the moves the engine expects to follow.
    expect(result.lines[0].pv).toMatchObject([
      { from: "e2", to: "e4" },
      { from: "e7", to: "e5" },
    ]);
  });

  it("reports no move when the game is already over", async () => {
    const transport = scriptedTransport(["bestmove (none)"]);
    const result = await new UciEngine(transport).analyse({ fen: START, depth: 1 });
    expect(result).toEqual({ bestMove: null, lines: [] });
  });

  it("runs searches one at a time", async () => {
    const transport = scriptedTransport(["bestmove e2e4"]);
    const engine = new UciEngine(transport);

    const first = engine.analyse({ fen: START, depth: 1 });
    const second = engine.analyse({ fen: START, depth: 2 });
    await Promise.all([first, second]);

    const goCommands = transport.sent.filter((command) => command.startsWith("go"));
    expect(goCommands).toEqual(["go depth 1", "go depth 2"]);
    // The second search only started after the first one finished.
    expect(transport.sent.indexOf("go depth 1")).toBeLessThan(
      transport.sent.lastIndexOf("setoption name MultiPV value 1"),
    );
  });

  it("fails cleanly if the engine crashes", async () => {
    const transport = new FakeTransport();
    const engine = new UciEngine(transport);
    const search = engine.analyse({ fen: START, depth: 1 });

    transport.crash("could not load");

    await expect(search).rejects.toThrow("could not load");
    await expect(engine.analyse({ fen: START, depth: 1 })).rejects.toThrow("could not load");
  });

  it("closes the channel when disposed", () => {
    const transport = scriptedTransport([]);
    new UciEngine(transport).dispose();
    expect(transport.sent).toContain("quit");
    expect(transport.closed).toBe(true);
  });
});
