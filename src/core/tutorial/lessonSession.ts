import type { MoveRecord, Position, Square } from "../types";
import { ExerciseBoard } from "./exerciseBoard";
import type { Lesson, LessonStep, MoveGoal } from "./lessons";

export interface Feedback {
  kind: "success" | "retry";
  text: string;
}

/** Everything the screen needs to show the current step. */
export interface LessonView {
  lesson: Lesson;
  step: LessonStep;
  /** Counting from 1, for "Step 2 of 5". */
  stepNumber: number;
  stepCount: number;
  /** True once the learner has solved this step on this attempt. */
  solved: boolean;
  /** True if Next is allowed: the step is solved now, or was passed earlier. */
  canGoNext: boolean;
  /** False only on the first step. */
  canGoBack: boolean;
  feedback: Feedback | null;
  /** Squares to highlight on the board. */
  marks: Square[];
  /** How many moves are left in a "move" step, or null for other steps. */
  movesLeft: number | null;
  /** True after the last step has been finished. */
  complete: boolean;
}

/** How many moves a goal allows. One, unless the goal says otherwise. */
export function movesAllowed(goal: MoveGoal): number {
  return "maxMoves" in goal && goal.maxMoves ? goal.maxMoves : 1;
}

/** Checks whether the position on the board satisfies a goal. */
export function isGoalMet(goal: MoveGoal, position: Position, lastMove: MoveRecord | undefined): boolean {
  switch (goal.type) {
    case "reach":
      return position.pieces[goal.square]?.color === "white";
    case "capture-all":
      return !Object.values(position.pieces).some((piece) => piece.color === "black" && piece.type !== "king");
    case "play":
      return [goal, ...(goal.or ?? [])].some((move) => lastMove?.from === move.from && lastMove.to === move.to);
    case "checkmate":
      // Chess notation ends a move with "#" when it is checkmate.
      return lastMove?.san.endsWith("#") ?? false;
    case "promote":
      return lastMove?.promotion !== undefined;
    case "any":
      return lastMove !== undefined;
  }
}

/**
 * Runs one lesson: it keeps track of the current step, sets up the practice
 * board for it, and decides whether what the learner did was right.
 */
export class LessonSession {
  /** The practice board. The screen draws it and sends the learner's moves to it. */
  readonly board = new ExerciseBoard();

  private stepIndex = 0;
  /** The furthest step reached so far. Earlier steps never need solving again. */
  private furthestStep = 0;
  private solved = false;
  private complete = false;
  private feedback: Feedback | null = null;
  private listeners = new Set<() => void>();

  constructor(readonly lesson: Lesson) {
    this.board.onPositionChanged(() => this.checkMove());
    this.enterStep(0);
  }

  getView(): LessonView {
    const step = this.step;
    return {
      lesson: this.lesson,
      step,
      stepNumber: this.stepIndex + 1,
      stepCount: this.lesson.steps.length,
      solved: this.solved,
      canGoNext: this.canGoNext(),
      canGoBack: this.stepIndex > 0 && !this.complete,
      feedback: this.feedback,
      marks: this.marksFor(step),
      movesLeft:
        step.kind === "move" && !this.solved ? movesAllowed(step.goal) - this.board.movesPlayed : null,
      complete: this.complete,
    };
  }

  /** The learner clicked a square during a "pick" step. */
  pickSquare(square: Square): void {
    const step = this.step;
    if (step.kind !== "pick" || this.solved) return;

    if (square === step.answer) {
      this.solved = true;
      this.feedback = { kind: "success", text: step.success };
    } else {
      this.feedback = { kind: "retry", text: `That square is ${square}. Have another look and try again.` };
    }
    this.emit();
  }

  /** Goes to the next step. Returns false if the current one is not solved yet. */
  next(): boolean {
    if (!this.canGoNext()) return false;
    if (this.stepIndex === this.lesson.steps.length - 1) {
      this.complete = true;
      this.emit();
    } else {
      this.enterStep(this.stepIndex + 1);
    }
    return true;
  }

  /**
   * Goes back one step so the learner can read or practise it again.
   * Returns false on the first step.
   */
  back(): boolean {
    if (this.stepIndex === 0 || this.complete) return false;
    this.enterStep(this.stepIndex - 1);
    return true;
  }

  /** Puts the pieces back so the learner can try the step again. */
  restartStep(): void {
    if (!this.complete) this.enterStep(this.stepIndex);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private get step(): LessonStep {
    return this.lesson.steps[this.stepIndex];
  }

  private canGoNext(): boolean {
    if (this.complete) return false;
    // A step the learner already passed can be skipped when revisiting it.
    return this.solved || this.stepIndex < this.furthestStep;
  }

  private enterStep(index: number, feedback: Feedback | null = null): void {
    this.stepIndex = index;
    this.furthestStep = Math.max(this.furthestStep, index);
    this.feedback = feedback;
    // There is nothing to solve in an "info" step, so it starts solved.
    this.solved = this.step.kind === "info";
    this.board.load(this.step.fen, this.step.shownMove);
    // Pieces may only be moved during a "move" step.
    this.board.locked = this.step.kind !== "move";
    this.emit();
  }

  /** Called whenever the board changes. Judges the learner's move against the goal. */
  private checkMove(): void {
    const step = this.step;
    // movesPlayed is 0 right after a position is loaded, which is not a move.
    if (step.kind !== "move" || this.solved || this.board.movesPlayed === 0) return;

    const position = this.board.getPosition();
    if (isGoalMet(step.goal, position, position.lastMove)) {
      this.solved = true;
      this.feedback = { kind: "success", text: step.success };
      this.board.locked = true;
      this.emit();
    } else if (this.board.movesPlayed >= movesAllowed(step.goal)) {
      // Out of moves: put the pieces back and explain why.
      this.enterStep(this.stepIndex, {
        kind: "retry",
        text: "That move is allowed, but it does not do what this step asks. The pieces are back where they started, so try again.",
      });
    } else {
      this.emit();
    }
  }

  private marksFor(step: LessonStep): Square[] {
    const marks = [...(step.marks ?? [])];
    if (step.showMovesOf) marks.push(...this.board.reachableFrom(step.showMovesOf));
    if (step.kind === "move" && step.goal.type === "reach") marks.push(step.goal.square);
    return marks;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
