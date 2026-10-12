import { describe, expect, it } from "vitest";
import { squareAtPoint, squareCentre } from "./chessScene";

describe("squareCentre", () => {
  it("puts white's side towards positive z and file a towards negative x", () => {
    expect(squareCentre("a1")).toEqual({ x: -3.5, z: 3.5 });
    expect(squareCentre("h1")).toEqual({ x: 3.5, z: 3.5 });
    expect(squareCentre("a8")).toEqual({ x: -3.5, z: -3.5 });
    expect(squareCentre("e4")).toEqual({ x: 0.5, z: 0.5 });
  });
});

describe("squareAtPoint", () => {
  it("is the reverse of squareCentre for every square", () => {
    for (const file of "abcdefgh") {
      for (const rank of "12345678") {
        const square = file + rank;
        const { x, z } = squareCentre(square);
        expect(squareAtPoint(x, z)).toBe(square);
      }
    }
  });

  it("finds the square anywhere inside it, not just at the centre", () => {
    expect(squareAtPoint(0.01, 0.99)).toBe("e4");
    expect(squareAtPoint(0.99, 0.01)).toBe("e4");
    expect(squareAtPoint(-3.99, 3.99)).toBe("a1");
  });

  it("returns null for a point off the board", () => {
    expect(squareAtPoint(4.2, 0)).toBeNull();
    expect(squareAtPoint(0, -4.2)).toBeNull();
    expect(squareAtPoint(-4.01, 3)).toBeNull();
  });
});
