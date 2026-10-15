import type { PieceType } from "../../core/index";

// The shape of every chess piece, as plain numbers.
//
// Both boards draw from this one file: the 3D board spins each outline into
// a solid, and the flat board draws the same outline as a silhouette. The
// two sets therefore always match.
//
// A body outline is a list of [distance from the centre, height] points,
// read from the base upwards. One board square is 1 unit wide.

export type Outline = [radius: number, height: number][];

export const BODIES: Record<PieceType, Outline> = {
  pawn: [[0, 0], [0.26, 0], [0.26, 0.06], [0.19, 0.1], [0.11, 0.2], [0.09, 0.36], [0.15, 0.4], [0.09, 0.44], [0, 0.44]],
  rook: [[0, 0], [0.3, 0], [0.3, 0.07], [0.22, 0.12], [0.17, 0.5], [0.23, 0.56], [0.23, 0.78], [0.16, 0.78], [0.16, 0.7], [0, 0.7]],
  knight: [[0, 0], [0.3, 0], [0.3, 0.07], [0.21, 0.12], [0.16, 0.26], [0, 0.26]],
  bishop: [[0, 0], [0.29, 0], [0.29, 0.07], [0.2, 0.12], [0.11, 0.3], [0.09, 0.56], [0.16, 0.61], [0.1, 0.65], [0, 0.65]],
  queen: [[0, 0], [0.32, 0], [0.32, 0.08], [0.22, 0.13], [0.13, 0.4], [0.1, 0.8], [0.2, 0.86], [0.13, 0.9], [0.22, 1.06], [0.16, 1.06], [0, 0.98]],
  king: [[0, 0], [0.32, 0], [0.32, 0.08], [0.22, 0.13], [0.13, 0.4], [0.1, 0.84], [0.2, 0.9], [0.13, 0.94], [0.19, 1.08], [0, 1.08]],
};

/** A part that sits on top of a body: a ball (optionally stretched upwards) or a bar. */
export type Topper =
  | { kind: "ball"; radius: number; y: number; stretch?: number }
  | { kind: "bar"; width: number; height: number; y: number };

export const TOPPERS: Record<PieceType, Topper[]> = {
  pawn: [{ kind: "ball", radius: 0.14, y: 0.56 }],
  rook: [],
  knight: [],
  // A tall mitre with a small finial, so it cannot be mistaken for a pawn.
  bishop: [
    { kind: "ball", radius: 0.15, y: 0.86, stretch: 1.55 },
    { kind: "ball", radius: 0.05, y: 1.13 },
  ],
  queen: [{ kind: "ball", radius: 0.07, y: 1.1 }],
  // The king's cross: an upright bar and a crossbar.
  king: [
    { kind: "bar", width: 0.07, height: 0.24, y: 1.2 },
    { kind: "bar", width: 0.2, height: 0.07, y: 1.22 },
  ],
};

/** The knight's head, seen from the side: [forward, height] points around its edge. */
// Going round from the back of the neck: chest, jaw, muzzle, forehead, ear, mane.
export const KNIGHT_HEAD: [x: number, y: number][] = [
  [-0.18, 0.24], [0.18, 0.24], [0.16, 0.4], [0.1, 0.5], [0.2, 0.53],
  [0.31, 0.6], [0.32, 0.71], [0.24, 0.79], [0.15, 0.89], [0.08, 1.02],
  [0.0, 0.92], [-0.09, 0.97], [-0.17, 0.8], [-0.21, 0.6], [-0.2, 0.4],
];
