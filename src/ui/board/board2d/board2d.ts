import type { Color, Square } from "../../../core/index";
import type { BoardArrow, BoardView, BoardViewEvents, BoardViewState } from "../boardView";
import { PIECE_GLYPHS } from "../pieceGlyphs";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** How far the pointer must travel before a press counts as a drag. */
const DRAG_THRESHOLD_PX = 5;

interface DragInfo {
  from: Square;
  startX: number;
  startY: number;
  /** The copy of the piece that follows the pointer once dragging starts. */
  ghost: HTMLElement | null;
  /** True if the piece was already selected, so a plain click puts it down. */
  deselectOnClick: boolean;
}

/** The flat board, built from ordinary HTML elements. */
export class Board2D implements BoardView {
  private root: HTMLDivElement;
  private state: BoardViewState | null = null;
  private drag: DragInfo | null = null;

  constructor(container: HTMLElement, private events: BoardViewEvents) {
    this.root = document.createElement("div");
    this.root.className = "board";
    this.root.addEventListener("pointerdown", this.onPointerDown);
    container.append(this.root);
  }

  render(state: BoardViewState): void {
    this.state = state;
    const { position, orientation, selected, targets } = state;

    // White at the bottom shows rank 8 first; black at the bottom is mirrored.
    const ranks = orientation === "white" ? [...RANKS].reverse() : RANKS;
    const files = orientation === "white" ? FILES : [...FILES].reverse();
    const kingInCheck = position.inCheck ? this.findKing(state) : null;

    const squares: HTMLElement[] = [];
    for (const rank of ranks) {
      for (const file of files) {
        const square = file + rank;
        const piece = position.pieces[square];
        const el = document.createElement("div");
        el.dataset.square = square;

        const isDark = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0;
        el.className = `square ${isDark ? "dark" : "light"}`;
        if (square === selected) el.classList.add("selected");
        if (square === position.lastMove?.from || square === position.lastMove?.to) {
          el.classList.add("last-move");
        }
        if (square === kingInCheck) el.classList.add("in-check");
        if (targets.includes(square)) el.classList.add(piece ? "target-capture" : "target");
        if (state.warningSquares.includes(square)) el.classList.add("warning");
        el.setAttribute("aria-label", piece ? `${square}, ${piece.color} ${piece.type}` : square);

        // Coordinates along the left and bottom edges.
        if (file === files[0]) el.append(this.label("rank-label", rank));
        if (rank === ranks[ranks.length - 1]) el.append(this.label("file-label", file));

        const mark = state.marks.find((item) => item.square === square);
        if (mark) {
          const tint = document.createElement("span");
          tint.className = `square-mark mark-${mark.kind}`;
          el.append(tint);
        }

        if (piece) {
          const pieceEl = document.createElement("span");
          pieceEl.className = `piece ${piece.color}`;
          pieceEl.textContent = PIECE_GLYPHS[piece.type];
          // While dragging, the real piece hides and its ghost is shown instead.
          if (this.drag?.ghost && this.drag.from === square) pieceEl.classList.add("dragging");
          el.append(pieceEl);
        }
        squares.push(el);
      }
    }
    this.root.replaceChildren(...squares);
    if (state.arrows.length > 0) this.root.append(this.createArrowLayer(state.arrows, orientation));
  }

  /** Draws the arrows on a see-through layer above the board. */
  private createArrowLayer(arrows: BoardArrow[], orientation: Color): SVGElement {
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.setAttribute("class", "arrow-layer");
    // The drawing area is 8 x 8 units, so one unit is one square.
    svg.setAttribute("viewBox", "0 0 8 8");

    // The suggested move is drawn last so it sits on top of the others.
    const ordered = [...arrows].sort((a, b) => Number(a.kind === "move") - Number(b.kind === "move"));
    for (const arrow of ordered) svg.append(this.createArrow(arrow, orientation));
    return svg;
  }

  private createArrow({ from, to, kind }: BoardArrow, orientation: Color): SVGElement {
    // Explaining arrows are thinner than the arrow for the move itself.
    const scale = kind === "move" ? 1 : 0.65;

    const centre = (square: Square) => {
      const file = FILES.indexOf(square[0]);
      const rank = RANKS.indexOf(square[1]);
      return orientation === "white"
        ? { x: file + 0.5, y: 7 - rank + 0.5 }
        : { x: 7 - file + 0.5, y: rank + 0.5 };
    };
    const start = centre(from);
    const tip = centre(to);

    // (ux, uy) points along the arrow; (px, py) points across it.
    const length = Math.hypot(tip.x - start.x, tip.y - start.y) || 1;
    const ux = (tip.x - start.x) / length;
    const uy = (tip.y - start.y) / length;
    const px = -uy;
    const py = ux;

    const SHAFT = 0.09 * scale; // half the width of the line
    const HEAD = 0.28 * scale; // half the width of the arrow head
    const HEAD_LENGTH = 0.45 * scale;
    const tail = { x: start.x + ux * 0.25, y: start.y + uy * 0.25 };
    const neck = { x: tip.x - ux * HEAD_LENGTH, y: tip.y - uy * HEAD_LENGTH };

    const points = [
      [tail.x + px * SHAFT, tail.y + py * SHAFT],
      [neck.x + px * SHAFT, neck.y + py * SHAFT],
      [neck.x + px * HEAD, neck.y + py * HEAD],
      [tip.x, tip.y],
      [neck.x - px * HEAD, neck.y - py * HEAD],
      [neck.x - px * SHAFT, neck.y - py * SHAFT],
      [tail.x - px * SHAFT, tail.y - py * SHAFT],
    ];
    const shape = document.createElementNS(SVG_NAMESPACE, "polygon");
    shape.setAttribute("class", `arrow-${kind}`);
    shape.setAttribute("points", points.map(([x, y]) => `${x},${y}`).join(" "));
    return shape;
  }

  destroy(): void {
    this.endDrag();
    this.root.remove();
  }

  private label(className: string, text: string): HTMLElement {
    const el = document.createElement("span");
    el.className = `coord ${className}`;
    el.textContent = text;
    return el;
  }

  private findKing(state: BoardViewState): Square | null {
    const { pieces, turn } = state.position;
    for (const square in pieces) {
      if (pieces[square].type === "king" && pieces[square].color === turn) return square;
    }
    return null;
  }

  private squareAt(target: EventTarget | Element | null): Square | null {
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>("[data-square]")?.dataset.square ?? null;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const square = this.squareAt(event.target);
    if (!square || !this.state || event.button !== 0) return;
    event.preventDefault();

    const wasSelected = this.state.selected === square;
    // Picking re-renders the board, so this.state is fresh afterwards.
    if (!wasSelected) this.events.onPick(square);

    // If the square now holds the selected piece, the player may drag it.
    if (this.state.selected === square) {
      this.drag = {
        from: square,
        startX: event.clientX,
        startY: event.clientY,
        ghost: null,
        deselectOnClick: wasSelected,
      };
      window.addEventListener("pointermove", this.onPointerMove);
      window.addEventListener("pointerup", this.onPointerUp);
      window.addEventListener("pointercancel", this.onPointerCancel);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;

    if (!drag.ghost) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (distance < DRAG_THRESHOLD_PX) return;
      drag.ghost = this.createGhost(drag.from);
    }
    if (drag.ghost) {
      drag.ghost.style.left = `${event.clientX}px`;
      drag.ghost.style.top = `${event.clientY}px`;
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    const wasDragging = drag.ghost !== null;
    this.endDrag();

    if (!wasDragging) {
      if (drag.deselectOnClick) this.events.onPick(drag.from);
      return;
    }
    const dropSquare = this.squareAt(document.elementFromPoint(event.clientX, event.clientY));
    if (dropSquare && dropSquare !== drag.from) this.events.onDrop(drag.from, dropSquare);
  };

  private onPointerCancel = (): void => {
    this.endDrag();
  };

  private createGhost(from: Square): HTMLElement | null {
    const original = this.root.querySelector<HTMLElement>(`[data-square="${from}"] .piece`);
    if (!original) return null;

    const ghost = original.cloneNode(true) as HTMLElement;
    ghost.classList.add("drag-ghost");
    ghost.style.fontSize = getComputedStyle(original).fontSize;
    document.body.append(ghost);
    original.classList.add("dragging");
    return ghost;
  }

  /** Stops any drag and shows the real piece again. */
  private endDrag(): void {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    this.drag?.ghost?.remove();
    this.drag = null;
    if (this.state) this.render(this.state);
  }
}
