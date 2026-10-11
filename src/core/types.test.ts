import { describe, expect, it } from "vitest";
import { isSquare } from "./types";

describe("isSquare", () => {
  it("accepts the four corners of the board", () => {
    for (const square of ["a1", "a8", "h1", "h8"]) {
      expect(isSquare(square)).toBe(true);
    }
  });

  it("rejects squares that are off the board", () => {
    for (const square of ["i1", "a9", "a0", "", "e", "e44", "E4"]) {
      expect(isSquare(square)).toBe(false);
    }
  });
});
