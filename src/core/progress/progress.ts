import { LESSONS } from "../tutorial/lessons";
import type { LessonId } from "../tutorial/lessons";

/**
 * A place to keep small pieces of text between visits. In the browser this
 * is localStorage; tests use a plain object. core/ only knows this interface.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const STORAGE_KEY = "vr-chess-academy.tutorial";

/** Remembers which tutorial lessons the learner has finished. */
export class TutorialProgress {
  private completed: Set<LessonId>;

  constructor(private store: KeyValueStore) {
    this.completed = new Set(this.read());
  }

  isComplete(id: LessonId): boolean {
    return this.completed.has(id);
  }

  markComplete(id: LessonId): void {
    this.completed.add(id);
    this.store.set(STORAGE_KEY, JSON.stringify([...this.completed]));
  }

  completedCount(): number {
    return this.completed.size;
  }

  allComplete(): boolean {
    return LESSONS.every((lesson) => this.completed.has(lesson.id));
  }

  /** Reads the saved list, ignoring anything that is damaged or unknown. */
  private read(): LessonId[] {
    try {
      const saved: unknown = JSON.parse(this.store.get(STORAGE_KEY) ?? "[]");
      if (!Array.isArray(saved)) return [];
      const known = LESSONS.map((lesson) => lesson.id as string);
      return saved.filter((id): id is LessonId => typeof id === "string" && known.includes(id));
    } catch {
      return [];
    }
  }
}
