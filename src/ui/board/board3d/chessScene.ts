import * as THREE from "three";
import type { Square } from "../../../core/index";
import type { BoardArrow, BoardViewState } from "../boardView";
import { createPiece } from "./pieceModels";

// The 3D chess set itself: the board, the pieces and the highlights, with no
// camera, canvas or mouse handling. Keeping it separate means the same scene
// can be shown on a web page now and inside a VR headset later.
//
// Layout: one square is 1 unit wide and the board is centred on the origin.
// White's side is towards positive z, so file a is at negative x.

const FILES = "abcdefgh";

const COLOURS = {
  light: 0xecdcc0,
  dark: 0xa97b55,
  frame: 0x6b4a2f,
  selected: 0xf2d34c,
  lastMove: 0xf2d34c,
  check: 0xd1362f,
  target: 0x1f2430,
  move: 0x2f6f4f,
  // The same colours as the hint marks on the 2D board.
  control: 0x2f7fd1,
  attack: 0xd1362f,
  danger: 0xe08a1a,
  support: 0x8a52c7,
};

/** Where the middle of a square is on the board. */
export function squareCentre(square: Square): { x: number; z: number } {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  return { x: file - 3.5, z: 3.5 - rank };
}

/** The square under a point on the board's surface, or null if it is off the board. */
export function squareAtPoint(x: number, z: number): Square | null {
  const file = Math.floor(x + 4);
  const rank = Math.floor(4 - z);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${rank + 1}`;
}

export class ChessScene {
  /** Add this to a Three.js scene to show the chess set. */
  readonly root = new THREE.Group();

  private pieces = new THREE.Group();
  private overlays = new THREE.Group();
  /** An invisible sheet on the board's surface, used to find which square was clicked. */
  private surface: THREE.Mesh;
  private pieceAt = new Map<Square, THREE.Group>();

  constructor() {
    this.root.add(this.buildBoard(), this.pieces, this.overlays);

    this.surface = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.surface.rotation.x = -Math.PI / 2;
    this.root.add(this.surface);
  }

  /** Redraws the pieces and highlights for a new state. */
  update(state: BoardViewState): void {
    this.clear(this.pieces);
    this.clear(this.overlays, true);
    this.pieceAt.clear();

    const { position, selected, targets } = state;
    for (const [square, piece] of Object.entries(position.pieces)) {
      const model = createPiece(piece.type, piece.color);
      const { x, z } = squareCentre(square);
      model.position.set(x, 0, z);
      // Remember the square so a click on the piece can be traced back to it.
      model.userData.square = square;
      this.pieces.add(model);
      this.pieceAt.set(square, model);
    }

    // Coloured tiles lying just above the board.
    if (position.lastMove) {
      this.addTile(position.lastMove.from, COLOURS.lastMove, 0.35);
      this.addTile(position.lastMove.to, COLOURS.lastMove, 0.35);
    }
    for (const mark of state.marks) this.addTile(mark.square, COLOURS[mark.kind], 0.5);
    if (selected) this.addTile(selected, COLOURS.selected, 0.75);
    if (position.inCheck) {
      const king = Object.entries(position.pieces).find(
        ([, piece]) => piece.type === "king" && piece.color === position.turn,
      );
      if (king) this.addTile(king[0], COLOURS.check, 0.7);
    }

    // Legal moves: a dot on an empty square, a ring around a piece that can be taken.
    for (const square of targets) {
      if (position.pieces[square]) this.addRing(square);
      else this.addDot(square);
    }
    for (const arrow of state.arrows) this.addArrow(arrow);
  }

  /** The model standing on a square, used to animate a move. */
  pieceOn(square: Square): THREE.Group | undefined {
    return this.pieceAt.get(square);
  }

  /** Finds the square a ray points at: a piece first, then the board beneath. */
  pick(raycaster: THREE.Raycaster): Square | null {
    const hitPiece = raycaster.intersectObjects(this.pieces.children, true)[0];
    if (hitPiece) {
      // The ray hits a part of the piece; walk up to the piece itself.
      let object: THREE.Object3D | null = hitPiece.object;
      while (object && !object.userData.square) object = object.parent;
      if (object) return object.userData.square as Square;
    }
    const hitBoard = raycaster.intersectObject(this.surface)[0];
    if (!hitBoard) return null;
    const local = this.root.worldToLocal(hitBoard.point.clone());
    return squareAtPoint(local.x, local.z);
  }

  /** Frees the memory held by the highlights. Call when the board is removed. */
  dispose(): void {
    this.clear(this.pieces);
    this.clear(this.overlays, true);
  }

  private buildBoard(): THREE.Group {
    const board = new THREE.Group();
    const tile = new THREE.BoxGeometry(1, 0.1, 1);
    const light = new THREE.MeshStandardMaterial({ color: COLOURS.light, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: COLOURS.dark, roughness: 0.8 });

    for (let file = 0; file < 8; file++) {
      for (let rank = 0; rank < 8; rank++) {
        // a1 is a dark square, so file + rank is even on dark squares.
        const mesh = new THREE.Mesh(tile, (file + rank) % 2 === 0 ? dark : light);
        mesh.position.set(file - 3.5, -0.05, 3.5 - rank);
        mesh.receiveShadow = true;
        board.add(mesh);
      }
    }

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.18, 9),
      new THREE.MeshStandardMaterial({ color: COLOURS.frame, roughness: 0.7 }),
    );
    frame.position.y = -0.1;
    frame.receiveShadow = true;
    board.add(frame);

    // File letters along both of the players' edges, rank numbers along the sides.
    for (let i = 0; i < 8; i++) {
      board.add(this.label(FILES[i], i - 3.5, 4.25), this.label(FILES[i], i - 3.5, -4.25));
      board.add(this.label(String(i + 1), -4.25, 3.5 - i), this.label(String(i + 1), 4.25, 3.5 - i));
    }
    return board;
  }

  /** A letter or number painted on a small flat tile on the board's frame. */
  private label(text: string, x: number, z: number): THREE.Mesh {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ecdcc0";
    context.font = "bold 44px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 32, 34);

    const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.001, z);
    return mesh;
  }

  private flat(geometry: THREE.BufferGeometry, color: number, opacity: number, square: Square, y: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    const { x, z } = squareCentre(square);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.overlays.add(mesh);
  }

  private addTile(square: Square, color: number, opacity: number): void {
    this.flat(new THREE.PlaneGeometry(1, 1), color, opacity, square, 0.004);
  }

  private addDot(square: Square): void {
    this.flat(new THREE.CircleGeometry(0.16, 24), COLOURS.target, 0.35, square, 0.008);
  }

  private addRing(square: Square): void {
    this.flat(new THREE.RingGeometry(0.4, 0.47, 32), COLOURS.attack, 0.85, square, 0.008);
  }

  /** A flat arrow lying on the board from one square to another. */
  private addArrow({ from, to, kind }: BoardArrow): void {
    const start = squareCentre(from);
    const tip = squareCentre(to);
    const length = Math.hypot(tip.x - start.x, tip.z - start.z) || 1;
    // Explaining arrows are thinner than the arrow for the move itself.
    const scale = kind === "move" ? 1 : 0.65;
    const shaft = 0.09 * scale;
    const head = 0.28 * scale;
    const headLength = 0.45 * scale;

    // Drawn pointing along +x from the origin, then turned and moved into place.
    const shape = new THREE.Shape();
    shape.moveTo(0.25, shaft);
    shape.lineTo(length - headLength, shaft);
    shape.lineTo(length - headLength, head);
    shape.lineTo(length, 0);
    shape.lineTo(length - headLength, -head);
    shape.lineTo(length - headLength, -shaft);
    shape.lineTo(0.25, -shaft);
    shape.closePath();

    const material = new THREE.MeshBasicMaterial({
      color: COLOURS[kind],
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.rotation.x = -Math.PI / 2;
    // After lying flat, turning about the vertical axis aims it at the target.
    mesh.rotation.z = Math.atan2(-(tip.z - start.z), tip.x - start.x);
    mesh.position.set(start.x, 0.012, start.z);
    this.overlays.add(mesh);
  }

  /** Empties a group. Highlights own their shapes, so those are freed too. */
  private clear(group: THREE.Group, disposeGeometry = false): void {
    for (const child of [...group.children]) {
      group.remove(child);
      if (disposeGeometry && child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }
}
