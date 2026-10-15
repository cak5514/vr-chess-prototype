import * as THREE from "three";
import type { Color, PieceType } from "../../../core/index";
import { BODIES, KNIGHT_HEAD, TOPPERS } from "../pieceOutlines";
import type { Outline, Topper } from "../pieceOutlines";

// The 3D chess pieces, built in code so the project needs no model files.
//
// Most pieces are made on a "lathe": a side outline is drawn as a list of
// points and spun around the vertical axis, the way a potter shapes a vase.
// The outlines live in pieceOutlines.ts, which the flat board also draws from.

function lathe(outline: Outline): THREE.BufferGeometry {
  const points = outline.map(([radius, height]) => new THREE.Vector2(radius, height));
  return new THREE.LatheGeometry(points, 32);
}

function topperGeometry(topper: Topper): THREE.BufferGeometry {
  if (topper.kind === "ball") {
    const geometry = new THREE.SphereGeometry(topper.radius, 20, 14);
    geometry.scale(1, topper.stretch ?? 1, 1);
    geometry.translate(0, topper.y, 0);
    return geometry;
  }
  // A bar is as deep as the thinner of its two sides.
  const depth = Math.min(topper.width, topper.height);
  const geometry = new THREE.BoxGeometry(topper.width, topper.height, depth);
  geometry.translate(0, topper.y, 0);
  return geometry;
}

/** The knight's head: a flat side-on horse shape given some thickness. */
function knightHead(): THREE.BufferGeometry {
  const shape = new THREE.Shape(KNIGHT_HEAD.map(([x, y]) => new THREE.Vector2(x, y)));
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

// Shapes and materials are made once and shared by every piece of that kind.
const geometryCache = new Map<PieceType, THREE.BufferGeometry[]>();

// Pale and graphite, with a soft satin finish like turned and lacquered wood.
const MATERIALS: Record<Color, THREE.MeshStandardMaterial> = {
  white: new THREE.MeshStandardMaterial({ color: 0xefe9da, roughness: 0.42, metalness: 0.04 }),
  black: new THREE.MeshStandardMaterial({ color: 0x26272a, roughness: 0.36, metalness: 0.22 }),
};

function geometriesFor(type: PieceType): THREE.BufferGeometry[] {
  let parts = geometryCache.get(type);
  if (!parts) {
    parts = [lathe(BODIES[type]), ...TOPPERS[type].map(topperGeometry)];
    if (type === "knight") parts.push(knightHead());
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
