import { describe, expect, it } from "vitest";
import { interpretLogits } from "./moveClassifier";
import type { ModelInfo } from "./moveClassifier";

const INFO: ModelInfo = {
  labels: ["ordinary", "sacrifice", "fork"],
  thresholds: [0.5, 0.5, 0.8],
  inputPlanes: 26,
};

describe("interpretLogits", () => {
  it("turns raw scores into probabilities", () => {
    const { all } = interpretLogits([0, 10, -10], INFO);
    expect(all[0]).toEqual({ label: "ordinary", probability: 0.5 });
    expect(all[1].probability).toBeGreaterThan(0.99);
    expect(all[2].probability).toBeLessThan(0.01);
  });

  it("keeps only the labels that reach their own threshold", () => {
    // A score of 1 is a probability of about 0.73: enough for "sacrifice"
    // (threshold 0.5) but not for "fork" (threshold 0.8).
    const { ideas } = interpretLogits([-5, 1, 1], INFO);
    expect(ideas.map((idea) => idea.label)).toEqual(["sacrifice"]);
  });

  it("lists the most likely idea first", () => {
    const { ideas } = interpretLogits([-5, 1, 4], INFO);
    expect(ideas.map((idea) => idea.label)).toEqual(["fork", "sacrifice"]);
  });

  it("returns no ideas when the model is not confident about anything", () => {
    expect(interpretLogits([-3, -3, -3], INFO).ideas).toEqual([]);
  });
});
