import type { MoveChoice } from "../types";

// The interface between the game and the trained neural network.
//
// core/ only knows this interface. The real model runs in the browser from
// platform/ (it needs a library that core/ must not depend on), and the tests
// use a fake. The model is trained by the Python code in training/.

/** The ideas the model can recognise in a move. Must match training/labels.py. */
export type IdeaLabel =
  | "ordinary"
  | "sacrifice"
  | "fork"
  | "pin"
  | "skewer"
  | "discoveredAttack"
  | "doubleCheck"
  | "attraction"
  | "deflection"
  | "trappedPiece"
  | "hangingPiece"
  | "capturingDefender"
  | "defensiveMove"
  | "quietMove"
  | "mate";

export interface IdeaScore {
  label: IdeaLabel;
  /** How sure the model is, from 0 to 1. */
  probability: number;
}

/** What the model thinks about one move. */
export interface MoveIdeas {
  /** The ideas the model is confident about, most likely first. Often empty. */
  ideas: IdeaScore[];
  /** Every label with its probability, for anything that wants the detail. */
  all: IdeaScore[];
}

/** The settings saved next to the model file (public/model/move_classifier.json). */
export interface ModelInfo {
  labels: string[];
  /** How sure the model must be, per label, before we accept the label. */
  thresholds: number[];
  inputPlanes: number;
}

/** Anything that can say which ideas a move carries. */
export interface MoveClassifier {
  /** Classifies several moves from the same position in one go. */
  classify(fen: string, moves: MoveChoice[]): Promise<MoveIdeas[]>;
}

/** Squashes any number into the range 0 to 1. Large positive numbers approach 1. */
function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

/**
 * Turns the model's raw output for one move into labelled ideas.
 *
 * The network produces one raw score per label. A sigmoid turns each score
 * into a probability, and a label is accepted when its probability reaches
 * that label's threshold (chosen during training).
 */
export function interpretLogits(logits: ArrayLike<number>, info: ModelInfo): MoveIdeas {
  const all: IdeaScore[] = info.labels.map((label, i) => ({
    label: label as IdeaLabel,
    probability: sigmoid(logits[i]),
  }));
  const ideas = all
    .filter((score, i) => score.probability >= info.thresholds[i])
    .sort((a, b) => b.probability - a.probability);
  return { ideas, all };
}
