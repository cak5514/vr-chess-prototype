import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  attackedSquaresFrom,
  fileKind,
  findMateInOne,
  isPassedPawn,
  listInWords,
  materialOf,
  moveInWords,
  passTurn,
} from "./boardFacts";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("attackedSquaresFrom", () => {
  it("lists a knight's squares in order", () => {
    expect(attackedSquaresFrom(new Chess(START), "g1")).toEqual(["e2", "f3", "h3"]);
  });

  it("stops at the first piece in the way", () => {
    // The rook on a1 sees only its two neighbours at the start.
    expect(attackedSquaresFrom(new Chess(START), "a1")).toEqual(["a2", "b1"]);
  });

  it("returns nothing for an empty square", () => {
    expect(attackedSquaresFrom(new Chess(START), "e4")).toEqual([]);
  });
});

describe("passTurn", () => {
  it("gives the move to the other side and clears en passant", () => {
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    expect(passTurn(afterE4)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1");
  });
});

describe("findMateInOne", () => {
  it("finds a back-rank mate", () => {
    const mate = findMateInOne("6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1");
    expect(mate).toMatchObject({ from: "e1", to: "e8" });
  });

  it("returns null when there is none", () => {
    expect(findMateInOne(START)).toBeNull();
  });
});

describe("materialOf", () => {
  it("adds up one side's pieces without the king", () => {
    // 8 pawns + 2 knights + 2 bishops + 2 rooks + queen = 8 + 6 + 6 + 10 + 9
    expect(materialOf(new Chess(START), "w")).toBe(39);
  });
});

describe("fileKind", () => {
  const chess = new Chess("4k3/p2p4/8/8/8/8/P1P5/4K3 w - - 0 1");

  it("tells open, half-open and closed files apart", () => {
    expect(fileKind(chess, "h", "w")).toBe("open"); // no pawns at all
    expect(fileKind(chess, "d", "w")).toBe("half-open"); // only a black pawn
    expect(fileKind(chess, "c", "w")).toBe("closed"); // white's own pawn
    expect(fileKind(chess, "a", "w")).toBe("closed");
  });

  it("depends on whose pawns we ask about", () => {
    expect(fileKind(chess, "c", "b")).toBe("half-open");
  });
});

describe("isPassedPawn", () => {
  it("is true when no enemy pawn is ahead on the same or next files", () => {
    expect(isPassedPawn(new Chess("4k3/8/8/3P4/8/8/8/4K3 w - - 0 1"), "d5")).toBe(true);
    // An enemy pawn behind it does not matter.
    expect(isPassedPawn(new Chess("4k3/8/8/3P4/2p5/8/8/4K3 w - - 0 1"), "d5")).toBe(true);
  });

  it("is false when an enemy pawn can block or capture it", () => {
    expect(isPassedPawn(new Chess("4k3/3p4/8/3P4/8/8/8/4K3 w - - 0 1"), "d5")).toBe(false);
    expect(isPassedPawn(new Chess("4k3/2p5/8/3P4/8/8/8/4K3 w - - 0 1"), "d5")).toBe(false);
  });

  it("works for black pawns moving down the board", () => {
    expect(isPassedPawn(new Chess("4k3/8/8/8/3p4/8/8/4K3 w - - 0 1"), "d4")).toBe(true);
    expect(isPassedPawn(new Chess("4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1"), "d4")).toBe(false);
  });

  it("is false for anything that is not a pawn", () => {
    expect(isPassedPawn(new Chess(START), "e1")).toBe(false);
  });
});

describe("words", () => {
  it("describes moves without notation", () => {
    const chess = new Chess("r3k2r/8/8/3p4/4P3/8/8/R3K2R w KQkq - 0 1");
    const moves = chess.moves({ verbose: true });
    const find = (san: string) => moves.find((move) => move.san === san)!;

    expect(moveInWords(find("exd5"))).toBe("pawn takes the pawn on d5");
    expect(moveInWords(find("Ke2"))).toBe("king to e2");
    expect(moveInWords(find("O-O"))).toBe("castling");
  });

  it("joins lists naturally", () => {
    expect(listInWords([])).toBe("");
    expect(listInWords(["d4"])).toBe("d4");
    expect(listInWords(["d4", "e5"])).toBe("d4 and e5");
    expect(listInWords(["c5", "d4", "e5"])).toBe("c5, d4 and e5");
  });
});
