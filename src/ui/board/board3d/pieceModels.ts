import * as THREE from "three";
import type { Color, PieceType } from "../../../core/index";

// The 3D chess pieces, built in code so the project needs no model files.
//
// Most pieces are made on a "lathe": a side outline is drawn as a list of
// points and spun around the vertical axis, the way a potter shapes a vase.
// Each point is [distance from the centre, height]. One board square is 1
// unit wide, so a radius of 0.3 leaves a comfortable gap around the piece.

type Outline = [radius: number, height: number][];

const BODIES: Record<PieceType, Outline> = {
  pawn: [[0, 0], [0.26, 0], [0.26, 0.06], [0.19, 0.1], [0.11, 0.2], [0.09, 0.36], [0.15, 0.4], [0.09, 0.44], [0, 0.44]],
  rook: [[0, 0], [0.3, 0], [0.3, 0.07], [0.22, 0.12], [0.17, 0.5], [0.23, 0.56], [0.23, 0.78], [0.16, 0.78], [0.16, 0.7], [0, 0.7]],
  knight: [[0, 0], [0.3, 0], [0.3, 0.07], [0.21, 0.12], [0.16, 0.26], [0, 0.26]],
  bishop: [[0, 0], [0.29, 0], [0.29, 0.07], [0.2, 0.12], [0.11, 0.3], [0.09, 0.56], [0.16, 0.61], [0.1, 0.65], [0, 0.65]],
  queen: [[0, 0], [0.32, 0], [0.32, 0.08], [0.22, 0.13], [0.13, 0.4], [0.1, 0.8], [0.2, 0.86], [0.13, 0.9], [0.22, 1.06], [0.16, 1.06], [0, 0.98]],
  king: [[0, 0], [0.32, 0], [0.32, 0.08], [0.22, 0.13], [0.13, 0.4], [0.1, 0.84], [0.2, 0.9], [0.13, 0.94], [0.19, 1.08], [0, 1.08]],
};

function lathe(outline: Outline): THREE.BufferGeometry {
  const points = outline.map(([radius, height]) => new THREE.Vector2(radius, height));
  return new THREE.LatheGeometry(points, 28);
}

function sphere(radius: number, y: number, stretch = 1): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(radius, 20, 14);
  geometry.scale(1, stretch, 1);
  geometry.translate(0, y, 0);
  return geometry;
}

function box(width: number, height: number, depth: number, y: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(0, y, 0);
  return geometry;
}

/** The knight's head: a flat side-on horse shape given some thickness. */
function knightHead(): THREE.BufferGeometry {
  const profile: [number, number][] = [
    [-0.16, 0.24], [0.16, 0.24], [0.13, 0.5], [0.27, 0.6], [0.25, 0.74],
    [0.1, 0.78], [0.03, 0.96], [-0.07, 0.92], [-0.17, 0.62],
  ];
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -0.08); // centre the thickness on the piece
  return geometry;
}

/** The extra parts that sit on top of each lathed body. */
function toppers(type: PieceType): THREE.BufferGeometry[] {
  switch (type) {
    case "pawn":
      return [sphere(0.14, 0.56)];
    case "bishop":
      return [sphere(0.13, 0.82, 1.45), sphere(0.045, 1.04)];
    case "queen":
      return [sphere(0.07, 1.1)];
    case "king":
      return [box(0.07, 0.24, 0.07, 1.2), box(0.2, 0.07, 0.07, 1.22)];
    case "knight":
      return [knightHead()];
    case "rook":
      return [];
  }
}

// Shapes and materials are made once and shared by every piece of that kind.
const geometryCache = new Map<PieceType, THREE.BufferGeometry[]>();

const MATERIALS: Record<Color, THREE.MeshStandardMaterial> = {
  white: new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.45, metalness: 0.05 }),
  black: new THREE.MeshStandardMaterial({ color: 0x33302c, roughness: 0.4, metalness: 0.1 }),
};

function geometriesFor(type: PieceType): THREE.BufferGeometry[] {
  let parts = geometryCache.get(type);
  if (!parts) {
    parts = [lathe(BODIES[type]), ...toppers(type)];
    geometryCache.set(type, parts);
  }
  return parts;
}

/** Builds one piece, standing on the origin. The caller moves it to its square. */
export function createPiece(type: PieceType, color: Color): THREE.Group {
  const group = new THREE.Group();
  for (const geometry of geometriesFor(type)) {
    const mesh = new THREE.Mesh(geometry, MATERIALS[color]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // The knight's head is a flat side-on shape, so it stands sideways to the
  // players, who then see the horse in profile. The two colours face opposite ways.
  if (type === "knight" && color === "black") group.rotation.y = Math.PI;
  return group;
}
