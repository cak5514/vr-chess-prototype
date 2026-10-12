import { describe, expect, it } from "vitest";
import { LESSONS } from "../tutorial/lessons";
import { TutorialProgress } from "./progress";
import type { KeyValueStore } from "./progress";

/** A store that lives in memory, standing in for the browser's localStorage. */
function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    get: (key) => data[key] ?? null,
    set: (key, value) => {
      data[key] = value;
    },
  };
}

describe("TutorialProgress", () => {
  it("starts with nothing complete", () => {
    const progress = new TutorialProgress(memoryStore());
    expect(progress.completedCount()).toBe(0);
    expect(progress.isComplete("rook")).toBe(false);
    expect(progress.allComplete()).toBe(false);
  });

  it("remembers a finished lesson", () => {
    const progress = new TutorialProgress(memoryStore());
    progress.markComplete("rook");
    progress.markComplete("rook"); // finishing it twice counts once
    expect(progress.isComplete("rook")).toBe(true);
    expect(progress.completedCount()).toBe(1);
  });

  it("is still there on the next visit", () => {
    const store = memoryStore();
    new TutorialProgress(store).markComplete("knight");

    const nextVisit = new TutorialProgress(store);
    expect(nextVisit.isComplete("knight")).toBe(true);
  });

  it("knows when every lesson is done", () => {
    const progress = new TutorialProgress(memoryStore());
    for (const lesson of LESSONS) progress.markComplete(lesson.id);
    expect(progress.allComplete()).toBe(true);
  });

  it("ignores saved data that is damaged or unknown", () => {
    const key = "vr-chess-academy.tutorial";
    expect(new TutorialProgress(memoryStore({ [key]: "not json" })).completedCount()).toBe(0);
    expect(new TutorialProgress(memoryStore({ [key]: '{"a":1}' })).completedCount()).toBe(0);

    const mixed = new TutorialProgress(memoryStore({ [key]: '["rook","dragon",7]' }));
    expect(mixed.completedCount()).toBe(1);
    expect(mixed.isComplete("rook")).toBe(true);
  });
});
