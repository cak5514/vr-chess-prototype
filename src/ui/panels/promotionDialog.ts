import type { Color, PromotionPiece } from "../../core/index";
import { createPieceIcon } from "../board/pieceIcon";

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
  // Each button holds a slot for the piece's picture, redrawn in the right colour when shown.
  const slots: { piece: PromotionPiece; slot: HTMLElement }[] = [];
  for (const { piece, label } of CHOICES) {
    const btn = document.createElement("button");
    btn.type = "button";
    const slot = document.createElement("span");
    slot.className = "promotion-piece";
    slots.push({ piece, slot });
    const text = document.createElement("span");
    text.textContent = label;
    btn.append(slot, text);
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
      if (color) for (const { piece, slot } of slots) slot.replaceChildren(createPieceIcon(piece, color));
    },
  };
}
