import type { Color, PromotionPiece } from "../../core/index";
import { PIECE_GLYPHS } from "../board/pieceGlyphs";

const CHOICES: { piece: PromotionPiece; label: string }[] = [
  { piece: "queen", label: "Queen" },
  { piece: "rook", label: "Rook" },
  { piece: "bishop", label: "Bishop" },
  { piece: "knight", label: "Knight" },
];

export interface PromotionActions {
  onChoose(piece: PromotionPiece): void;
  onCancel(): void;
}

/** The pop-up that asks what a pawn should become. */
export function createPromotionDialog(actions: PromotionActions) {
  const element = document.createElement("div");
  element.className = "promotion-overlay";
  element.hidden = true;

  const box = document.createElement("div");
  box.className = "promotion-box";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Choose a piece");

  const title = document.createElement("h2");
  title.textContent = "Your pawn reached the other side!";
  const hint = document.createElement("p");
  hint.textContent = "Choose what it becomes. The queen is almost always the best choice.";

  const choices = document.createElement("div");
  choices.className = "promotion-choices";
  const glyphs: HTMLElement[] = [];
  for (const { piece, label } of CHOICES) {
    const btn = document.createElement("button");
    btn.type = "button";
    const glyph = document.createElement("span");
    glyph.textContent = PIECE_GLYPHS[piece];
    glyphs.push(glyph);
    const text = document.createElement("span");
    text.textContent = label;
    btn.append(glyph, text);
    btn.addEventListener("click", () => actions.onChoose(piece));
    choices.append(btn);
  }

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "link-button";
  cancel.textContent = "Cancel and choose another move";
  cancel.addEventListener("click", actions.onCancel);

  box.append(title, hint, choices, cancel);
  element.append(box);

  return {
    element,
    /** Shows the dialog for `color`, or hides it when `color` is null. */
    update(color: Color | null): void {
      element.hidden = color === null;
      if (color) for (const glyph of glyphs) glyph.className = `piece ${color}`;
    },
  };
}
