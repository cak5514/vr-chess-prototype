import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Color } from "../../../core/index";
import type { BoardView, BoardViewEvents, BoardViewState } from "../boardView";
import { ChessScene, squareCentre } from "./chessScene";

/** How far the pointer may travel and still count as a click, not a drag to turn the board. */
const CLICK_TOLERANCE_PX = 6;
/** How long a piece takes to slide to its new square. */
const MOVE_ANIMATION_MS = 180;

/**
 * The 3D board. It follows the same BoardView contract as the 2D board, so
 * the rest of the app treats the two exactly alike.
 *
 * Click a piece and then a square to move. Drag to turn the board, and use
 * the scroll wheel to zoom.
 */
export class Board3D implements BoardView {
  private canvasHolder: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private controls: OrbitControls;
  private chess = new ChessScene();
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;

  private orientation: Color | null = null;
  private lastFen: string | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private animationFrame = 0;

  constructor(container: HTMLElement, private events: BoardViewEvents) {
    this.canvasHolder = document.createElement("div");
    this.canvasHolder.className = "board3d";
    container.prepend(this.canvasHolder);

    // This throws if the browser cannot do 3D graphics; the caller then keeps the 2D board.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvasHolder.append(this.renderer.domElement);

    this.scene.add(this.chess.root);
    this.addLights();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 20;
    // Stop the camera going below the table or directly overhead.
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = 1.35;
    this.controls.addEventListener("change", () => this.draw());

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);

    // Keep the picture sharp and square when the page layout changes.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvasHolder);
    this.resize();
  }

  render(state: BoardViewState): void {
    this.chess.update(state);

    // Put the camera behind the player's side whenever the board is flipped.
    if (state.orientation !== this.orientation) {
      this.orientation = state.orientation;
      this.camera.position.set(0, 11.5, state.orientation === "white" ? 10.5 : -10.5);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }

    const moved = state.position.fen !== this.lastFen && this.lastFen !== null;
    this.lastFen = state.position.fen;
    if (moved && state.position.lastMove) this.slidePiece(state.position.lastMove.from, state.position.lastMove.to);
    else this.draw();
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.chess.dispose();
    this.renderer.dispose();
    this.canvasHolder.remove();
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(5, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    // The area the shadow covers: a box a little bigger than the board.
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    this.scene.add(sun);
  }

  private draw(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const size = this.canvasHolder.clientWidth;
    if (size === 0) return;
    this.renderer.setSize(size, size);
    this.draw();
  }

  /** Slides the piece that just moved from its old square to its new one. */
  private slidePiece(from: string, to: string): void {
    const piece = this.chess.pieceOn(to);
    if (!piece) {
      this.draw();
      return;
    }
    const start = squareCentre(from);
    const end = squareCentre(to);
    const startedAt = performance.now();
    cancelAnimationFrame(this.animationFrame);

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / MOVE_ANIMATION_MS);
      // Ease out: fast at first, slowing as it arrives.
      const eased = 1 - (1 - progress) ** 2;
      piece.position.x = start.x + (end.x - start.x) * eased;
      piece.position.z = start.z + (end.z - start.z) * eased;
      this.draw();
      if (progress < 1) this.animationFrame = requestAnimationFrame(step);
    };
    step(startedAt);
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent): void => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || event.button !== 0) return;
    // A drag turns the board; only a press and release in one place is a click.
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_TOLERANCE_PX) return;

    // Convert the click to the -1..1 range Three.js uses, then cast a ray into the scene.
    const box = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -((event.clientY - box.top) / box.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const square = this.chess.pick(this.raycaster);
    if (square) this.events.onPick(square);
  };
}
