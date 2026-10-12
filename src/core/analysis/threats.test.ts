import { describe, expect, it } from "vitest";
import { describeThreat, findThreatenedPieces } from "./threats";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("findThreatenedPieces", () => {
  it("finds nothing at the start of the game", () => {
    expect(findThreatenedPieces(START, "white")).toEqual([]);
    expect(findThreatenedPieces(START, "black")).toEqual([]);
  });

  it("spots a hanging piece", () => {
    // White knight on e5 is attacked by the pawn on d6 and has no defender.
    const fen = "4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1";
    expect(findThreatenedPieces(fen, "white")).toEqual([
      { square: "e5", piece: "knight", kind: "hanging", attacker: "pawn", attackerSquare: "d6" },
    ]);
  });

  it("does not warn about a defended piece attacked by an equal piece", () => {
    // White knight on e5 is attacked by a knight and defended by the d4 pawn.
    const fen = "4k3/5n2/8/4N3/3P4/8/8/4K3 w - - 0 1";
    expect(findThreatenedPieces(fen, "white")).toEqual([]);
  });

  it("warns when a defended piece is attacked by something worth less", () => {
    // White queen on d4 is defended by the king's pawn, but a pawn attacks it.
    const fen = "4k3/8/8/4p3/3Q4/4P3/8/4K3 w - - 0 1";
    expect(findThreatenedPieces(fen, "white")).toMatchObject([
      { square: "d4", piece: "queen", kind: "attacked-by-weaker", attacker: "pawn" },
    ]);
  });

  it("names the least valuable attacker", () => {
    // The rook on d5 is attacked by both a queen and a bishop.
    const fen = "3qk3/8/8/3R4/8/8/6b1/4K3 w - - 0 1";
    expect(findThreatenedPieces(fen, "white")[0]).toMatchObject({
      square: "d5",
      attacker: "bishop",
      attackerSquare: "g2",
    });
  });

  it("lists the most valuable piece first", () => {
    // Black's rook on a8 attacks the pawn on a2; the bishop on h5 attacks the queen on d1.
    const fen = "r3k3/8/8/7b/8/8/P7/3QK3 w - - 0 1";
    const threats = findThreatenedPieces(fen, "white");
    expect(threats.map((threat) => threat.piece)).toEqual(["queen", "pawn"]);
  });

  it("looks at the colour it is asked about, whoever's turn it is", () => {
    // It is white's turn, but we ask about black: the pawn on c6 is
    // attacked by the knight on e5 and undefended.
    const fen = "4k3/8/2p5/4N3/8/8/8/4K3 w - - 0 1";
    expect(findThreatenedPieces(fen, "black")).toMatchObject([{ square: "c6", kind: "hanging" }]);
    expect(findThreatenedPieces(fen, "white")).toEqual([]);
  });

  it("leaves the king out, because that is check", () => {
    const fen = "4k3/8/8/8/8/8/8/r3K3 w - - 0 1";
    expect(findThreatenedPieces(fen, "white")).toEqual([]);
  });
});

describe("describeThreat", () => {
  it("explains a hanging piece", () => {
    const [threat] = findThreatenedPieces("4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1", "white");
    expect(describeThreat(threat)).toBe(
      "Your knight on e5 is attacked by the pawn on d6 and nothing defends it.",
    );
  });

  it("explains an attack by a weaker piece", () => {
    const [threat] = findThreatenedPieces("4k3/8/8/4p3/3Q4/4P3/8/4K3 w - - 0 1", "white");
    expect(describeThreat(threat)).toBe(
      "Your queen on d4 is attacked by the pawn on e5, which is worth less.",
    );
  });
});
