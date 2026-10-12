import { describe, expect, it } from "vitest";
import type { ChessEngine, EngineLine, EngineRequest, EngineResult } from "../engine/engine";
import type { MoveChoice } from "../types";
import { explainMove, findHint, HINT_DEPTH } from "./hint";
import type { HintContext } from "./hint";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function reasons(fen: string, from: string, to: string, context: HintContext = {}, promotion?: MoveChoice["promotion"]): string[] {
  return explainMove(fen, { from, to, promotion }, context)!.reasons.map((reason) => reason.text);
}

/** The full reasons, including what they highlight on the board. */
function marks(fen: string, from: string, to: string) {
  return explainMove(fen, { from, to })!.reasons;
}

function squaresOf(reason: { squares: { square: string }[] }): string[] {
  return reason.squares.map((mark) => mark.square).sort();
}

describe("explainMove: what gets highlighted on the board", () => {
  it("marks the squares a centre pawn controls, and the path it opens", () => {
    const [control, path] = marks(START, "e2", "e4");
    expect(control.kind).toBe("control");
    expect(squaresOf(control)).toEqual(["d5", "f5"]);
    // The bishop on f1 and the diagonal that just opened for it.
    expect(path.kind).toBe("support");
    expect(squaresOf(path)).toEqual(["a6", "b5", "c4", "d3", "f1"]);
  });

  it("marks the centre squares a knight controls", () => {
    const [control] = marks(START, "g1", "f3");
    expect(squaresOf(control)).toEqual(["d4", "e5"]);
    expect(control.squares.every((mark) => mark.kind === "control")).toBe(true);
  });

  it("draws an arrow to each piece in a fork", () => {
    const [fork] = marks("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5", "c7");
    expect(fork.kind).toBe("attack");
    expect(fork.arrows).toEqual([
      { from: "c7", to: "e8", kind: "attack" },
      { from: "c7", to: "a8", kind: "attack" },
    ]);
  });

  it("shows where the danger came from when a piece moves to safety", () => {
    const [escape] = marks("4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1", "e5", "f3");
    expect(escape.arrows).toEqual([{ from: "d6", to: "e5", kind: "danger" }]);
    expect(squaresOf(escape)).toEqual(["d6"]);
  });

  it("shows the defender and the attacker when a piece is defended", () => {
    const all = marks("4r1k1/8/8/4N3/8/8/3P4/6K1 w - - 0 1", "d2", "d4");
    const defend = all.find((reason) => reason.text.startsWith("It defends"))!;
    expect(defend.arrows).toEqual([
      { from: "d4", to: "e5", kind: "support" },
      { from: "e8", to: "e5", kind: "danger" },
    ]);
  });

  it("marks a captured piece and a new target", () => {
    const [capture] = marks("4k3/8/8/4n3/8/8/8/4RK2 w - - 0 1", "e1", "e5");
    expect(capture.squares).toEqual([{ square: "e5", kind: "attack" }]);

    const [attack] = marks("3q2k1/8/8/8/8/8/8/R5K1 w - - 0 1", "a1", "d1");
    expect(attack.arrows).toEqual([{ from: "d1", to: "d8", kind: "attack" }]);
  });

  it("shows the opponent's mating move that was stopped", () => {
    const [stop] = marks("r5k1/8/8/8/8/8/5PPP/6K1 w - - 0 1", "h2", "h3");
    expect(stop.arrows).toEqual([{ from: "a8", to: "a1", kind: "danger" }]);
  });

  it("marks nothing for reasons that have nothing to point at", () => {
    const [quiet] = marks("3qk3/8/8/8/8/8/8/3QK3 w - - 0 1", "e1", "f1");
    expect(quiet).toMatchObject({ kind: null, squares: [], arrows: [] });
  });
});

describe("explainMove: basics", () => {
  it("says what to do", () => {
    expect(explainMove(START, { from: "g1", to: "f3" })!.title).toBe("Move your knight from g1 to f3");
  });

  it("returns null for an illegal move", () => {
    expect(explainMove(START, { from: "e2", to: "e5" })).toBeNull();
  });

  it("never gives more than three reasons", () => {
    // A knight takes a hanging rook with check, forking the king and queen.
    const fen = "r2qk3/8/1N6/8/8/8/8/4K3 w - - 0 1";
    expect(reasons(fen, "b6", "a8").length).toBeLessThanOrEqual(3);
  });

  it("gives an honest fallback when no reason fits", () => {
    const fen = "3qk3/8/8/8/8/8/8/3QK3 w - - 0 1";
    expect(reasons(fen, "e1", "f1")).toEqual([
      "This is a quiet move that improves your position slightly. No single reason stands out, but the engine found nothing better.",
    ]);
  });
});

describe("explainMove: forced wins and emergencies", () => {
  it("recognises checkmate and says nothing else", () => {
    // Scholar's mate position, one move before Qxf7#.
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    expect(reasons(fen, "h5", "f7")).toEqual([
      "This is checkmate! The enemy king is attacked and has no way to escape.",
    ]);
  });

  it("announces a forced mate the engine has found", () => {
    const line: EngineLine = { move: { from: "e2", to: "e4" }, pv: [{ from: "e2", to: "e4" }], mateIn: 3 };
    expect(reasons(START, "e2", "e4", { line })[0]).toBe(
      "It starts a forced checkmate. Played correctly, you win in 3 moves whatever your opponent does.",
    );
  });

  it("explains how a move gets out of check", () => {
    const rookCheck = "4k3/8/8/8/8/8/8/r3K3 w - - 0 1";
    expect(reasons(rookCheck, "e1", "e2")).toEqual([
      "You are in check, and this moves your king to a safe square.",
    ]);
    // The white rook drops to c1, between the checking rook and the king.
    const block = "4k3/8/8/8/8/8/2R5/r3K3 w - - 0 1";
    expect(reasons(block, "c2", "c1")[0]).toBe("You are in check, and this blocks the attack on your king.");
    const capture = "4k3/8/8/8/8/8/1B6/r3K3 w - - 0 1";
    expect(reasons(capture, "b2", "a1")[0]).toBe(
      "You are in check, and this captures the piece attacking your king.",
    );
  });

  it("explains a move that stops a checkmate threat", () => {
    // Black threatens ...Ra1 mate on the back rank; h3 gives the king an escape square.
    const fen = "r5k1/8/8/8/8/8/5PPP/6K1 w - - 0 1";
    expect(reasons(fen, "h2", "h3")[0]).toBe(
      "It stops checkmate. Your opponent was threatening rook to a1.",
    );
  });
});

describe("explainMove: material", () => {
  it("explains capturing an undefended piece", () => {
    const fen = "4k3/8/8/4n3/8/8/8/4RK2 w - - 0 1";
    expect(reasons(fen, "e1", "e5")[0]).toBe(
      "It captures the knight on e5 for free, because nothing defends it.",
    );
  });

  it("explains winning a more valuable piece", () => {
    // A pawn takes a rook that is defended by the e7 pawn.
    const fen = "4k3/4p3/3r4/4P3/8/8/8/4K3 w - - 0 1";
    expect(reasons(fen, "e5", "d6")[0]).toBe(
      "It captures a rook with a pawn, winning the more valuable piece.",
    );
  });

  it("explains an even trade", () => {
    // Knight takes a knight that the d7 pawn defends.
    const fen = "4k3/3p4/4n3/8/3N4/8/8/4K3 w - - 0 1";
    expect(reasons(fen, "d4", "e6")[0]).toBe("It trades your knight for their knight, an even exchange.");
  });

  it("adds why trading helps when you are ahead", () => {
    const fen = "4k3/3p4/4n3/8/3N4/8/8/R3K3 w - - 0 1";
    expect(reasons(fen, "d4", "e6")[0]).toBe(
      "It trades your knight for their knight, an even exchange. You are ahead, and each trade makes that lead count for more.",
    );
  });

  it("recognises taking back after the opponent captured", () => {
    const fen = "4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1";
    const lastMove = { to: "d5", captured: "pawn" as const };
    expect(reasons(fen, "e4", "d5", { lastMove })[0]).toBe(
      "It takes back on d5. Your opponent just captured there, and this wins the material back.",
    );
  });

  it("explains a promotion", () => {
    const fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
    expect(reasons(fen, "a7", "a8", {}, "queen")[0]).toBe(
      "Your pawn reaches the last row and becomes a queen, your strongest possible upgrade.",
    );
  });
});

describe("explainMove: threats", () => {
  it("explains a fork", () => {
    // The knight lands on c7, attacking the king on e8 and the rook on a8.
    const fen = "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1";
    expect(reasons(fen, "d5", "c7")[0]).toBe(
      "It attacks two things at once: the king on e8 and the rook on a8. Your opponent can only save one. This is called a fork.",
    );
  });

  it("explains an ordinary check", () => {
    const fen = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1";
    expect(reasons(fen, "a1", "a8")).toContain(
      "It gives check, so your opponent must deal with that before anything else.",
    );
  });

  it("explains a discovered check", () => {
    // The bishop steps off the e-file and the rook behind it gives check.
    const fen = "4k3/8/8/8/4B3/8/8/4RK2 w - - 0 1";
    expect(reasons(fen, "e4", "d3")[0]).toBe(
      "It moves your bishop out of the way so the piece behind it gives check. This is called a discovered check.",
    );
  });

  it("explains a checkmate threat", () => {
    // The queen joins the bishop on the long diagonal, aiming at g7.
    const fen = "6k1/5p1p/6p1/8/8/8/1B6/3Q2K1 w - - 0 1";
    expect(reasons(fen, "d1", "d4").some((text) => text.startsWith("It threatens checkmate on your next move: queen"))).toBe(true);
  });

  it("explains a new attack and why it matters", () => {
    const fen = "3q2k1/8/8/8/8/8/8/R5K1 w - - 0 1";
    expect(reasons(fen, "a1", "d1")[0]).toBe("It attacks the queen on d8, which nothing defends.");
  });
});

describe("explainMove: safety", () => {
  it("explains moving a piece out of danger, naming the attacker", () => {
    const fen = "4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1";
    expect(reasons(fen, "e5", "f3")).toEqual([
      "Your knight was attacked by the pawn on d6. This moves it to safety.",
    ]);
  });

  it("explains defending a piece, naming the attacker", () => {
    const fen = "4r1k1/8/8/4N3/8/8/3P4/6K1 w - - 0 1";
    expect(reasons(fen, "d2", "d4")).toContain(
      "It defends your knight on e5, which was attacked by the rook on e8.",
    );
  });
});

describe("explainMove: the engine's plan", () => {
  it("mentions the follow-up when it wins material", () => {
    const fen = "3bk3/8/8/8/8/8/8/R3K3 w - - 0 1";
    const pv: MoveChoice[] = [
      { from: "e1", to: "e2" },
      { from: "d8", to: "a5" },
      { from: "a1", to: "a5" },
    ];
    const line: EngineLine = { move: pv[0], pv, scoreCp: 300 };
    expect(reasons(fen, "e1", "e2", { line })).toContain(
      "The idea: if your opponent replies with bishop to a5, you can win material with rook takes the bishop on a5.",
    );
  });

  it("does not call a simple recapture winning material", () => {
    // 1.d4 exd4 2.Qxd4 just swaps pawns.
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const pv: MoveChoice[] = [
      { from: "d2", to: "d4" },
      { from: "e5", to: "d4" },
      { from: "d1", to: "d4" },
    ];
    const line: EngineLine = { move: pv[0], pv, scoreCp: 20 };
    expect(reasons(fen, "d2", "d4", { line }).some((text) => text.startsWith("The idea"))).toBe(false);
  });

  it("stays quiet when the follow-up is not a winning capture", () => {
    const pv: MoveChoice[] = [
      { from: "e2", to: "e4" },
      { from: "e7", to: "e5" },
      { from: "g1", to: "f3" },
    ];
    const line: EngineLine = { move: pv[0], pv, scoreCp: 30 };
    expect(reasons(START, "e2", "e4", { line }).some((text) => text.startsWith("The idea"))).toBe(false);
  });
});

describe("explainMove: positional ideas", () => {
  it("explains a knight move by the centre squares it controls", () => {
    expect(reasons(START, "g1", "f3")).toEqual([
      "From f3 your knight controls the centre squares d4 and e5.",
    ]);
  });

  it("explains a bishop move by how many squares it reaches, and notes castling", () => {
    // After 1.e4 e5 2.Nf3 Nc6, the bishop comes out and frees f1 for castling.
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    expect(reasons(fen, "f1", "c4")).toContain(
      "It brings your bishop into play. From c4 it reaches 10 squares instead of being shut in behind its pawns. It also clears the way for you to castle.",
    );
  });

  it("explains a centre pawn by what it controls and what it opens", () => {
    expect(reasons(START, "e2", "e4")).toEqual([
      "It puts a pawn on e4, which controls d5 and f5 and claims space in the centre.",
      "It opens a path for your bishop on f1.",
    ]);
  });

  it("does not tell rooks, queens or kings to leave the back row", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    const afterE4E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const all = [
      ...reasons(fen, "a1", "b1"),
      ...reasons(fen, "e1", "d1"),
      ...reasons(afterE4E5, "d1", "e2"),
    ];
    for (const text of all) expect(text).not.toMatch(/back row|into play/);
  });

  it("stops talking about development once the opening is over", () => {
    // Move 20: a knight still on g1 moving out is no longer "opening advice".
    const fen = "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K1N1 w - - 0 20";
    for (const text of reasons(fen, "g1", "h3")) expect(text).not.toMatch(/centre square|into play/);
  });

  it("explains castling", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    const hint = explainMove(fen, { from: "e1", to: "g1" })!;
    expect(hint.title).toBe("Castle on the king's side");
    expect(hint.reasons.map((reason) => reason.text)).toEqual([
      "Castling moves your king behind its pawns, away from the open centre, and brings the rook towards the middle where it can join in.",
    ]);
  });

  it("explains putting a rook on an open file", () => {
    const fen = "4k3/pp3ppp/8/8/8/8/PP3PPP/R3K3 w - - 0 1";
    expect(reasons(fen, "a1", "d1")).toEqual([
      "It puts your rook on the open d-file, where no pawns block its path.",
    ]);
  });

  it("explains pushing a passed pawn", () => {
    const fen = "4k3/8/8/3P4/8/8/8/4K3 w - - 0 1";
    expect(reasons(fen, "d5", "d6")).toEqual([
      "No enemy pawn can block or capture this pawn any more. Each step brings it closer to becoming a queen.",
    ]);
  });

  it("explains bringing the king out once the queens are gone", () => {
    const fen = "4k3/p7/8/8/8/8/P7/4K3 w - - 0 1";
    expect(reasons(fen, "e1", "e2")).toEqual([
      "With the queens gone, your king is in far less danger and becomes a useful piece. Bring it towards the action.",
    ]);
  });

  it("explains a quiet pawn move by the squares it guards", () => {
    expect(reasons(START, "a2", "a3")).toEqual([
      "It guards b4, so enemy pieces cannot settle there.",
    ]);
  });

  it("falls back on how many more squares a piece reaches", () => {
    // Queens are still on, and the bishop leaves the corner for the centre.
    const fen = "3qk3/8/8/8/8/8/8/B2QK3 w - - 0 30";
    expect(reasons(fen, "a1", "d4")).toEqual([
      "From d4 your bishop reaches 13 squares, up from 7 where it was.",
    ]);
  });
});

describe("findHint", () => {
  function engineThatSays(bestMove: MoveChoice | null, line?: EngineLine) {
    const requests: EngineRequest[] = [];
    const engine: ChessEngine = {
      analyse: async (request): Promise<EngineResult> => {
        requests.push(request);
        return { bestMove, lines: line ? [line] : [] };
      },
      dispose: () => undefined,
    };
    return { engine, requests };
  }

  it("asks the engine at full strength and explains its move", async () => {
    const { engine, requests } = engineThatSays({ from: "e2", to: "e4" });
    const hint = await findHint(engine, START);

    expect(requests).toEqual([{ fen: START, depth: HINT_DEPTH, skillLevel: 20, lines: 1 }]);
    expect(hint).toMatchObject({ move: { from: "e2", to: "e4" }, title: "Move your pawn from e2 to e4" });
  });

  it("passes the engine's line on, so a forced mate is explained", async () => {
    const move = { from: "e2", to: "e4" };
    const { engine } = engineThatSays(move, { move, pv: [move], mateIn: 4 });
    const hint = await findHint(engine, START);
    expect(hint!.reasons[0].text).toContain("forced checkmate");
  });

  it("returns null when the engine has no move", async () => {
    const { engine } = engineThatSays(null);
    expect(await findHint(engine, START)).toBeNull();
  });
});
