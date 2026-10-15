import type { Color, PieceType } from "../../core/index";
import { BODIES, KNIGHT_HEAD, TOPPERS } from "./pieceOutlines";

// Draws a chess piece as a flat silhouette, from the same outlines the 3D
// board uses. Used on the flat board, in the promotion pop-up and as the
// lesson icons.

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
// The drawing is 100 units square. A flat silhouette looks thinner than the
// solid piece it comes from, so widths are stretched more than heights.
const SCALE_X = 92;
const SCALE_Y = 68;
const CENTRE_X = 50;
const BASE_Y = 96;

function x(value: number): number {
  return Math.round((CENTRE_X + value * SCALE_X) * 10) / 10;
}

function y(value: number): number {
  return Math.round((BASE_Y - value * SCALE_Y) * 10) / 10;
}

/** The body: the outline up the right-hand side, then mirrored back down the left. */
function bodyPath(type: PieceType): string {
  const outline = BODIES[type];
  const right = outline.map(([radius, height]) => `${x(radius)},${y(height)}`);
  const left = [...outline].reverse().map(([radius, height]) => `${x(-radius)},${y(height)}`);
  return `M${[...right, ...left].join(" L")} Z`;
}

function shape(tag: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/**
 * Builds the picture of one piece. Its colours come from CSS, through the
 * classes "piece" and "white" or "black".
 */
export function createPieceIcon(type: PieceType, color: Color): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", `piece ${color}`);
  // The square or button around it already says which piece this is.
  svg.setAttribute("aria-hidden", "true");

  // Black's knight faces the other way, as on the 3D board.
  const flip = type === "knight" && color === "black" ? -1 : 1;
  if (type === "knight") {
    const points = KNIGHT_HEAD.map(([forward, height]) => `${x(forward * flip)},${y(height)}`).join(" ");
    svg.append(shape("polygon", { points }));
  }
  svg.append(shape("path", { d: bodyPath(type) }));

  for (const topper of TOPPERS[type]) {
    if (topper.kind === "ball") {
      svg.append(
        shape("ellipse", {
          cx: CENTRE_X,
          cy: y(topper.y),
          rx: topper.radius * SCALE_X,
          ry: topper.radius * (topper.stretch ?? 1) * SCALE_Y,
        }),
      );
    } else {
      svg.append(
        shape("rect", {
          x: x(-topper.width / 2),
          y: y(topper.y + topper.height / 2),
          width: topper.width * SCALE_X,
          height: topper.height * SCALE_Y,
        }),
      );
    }
  }
  return svg;
}
