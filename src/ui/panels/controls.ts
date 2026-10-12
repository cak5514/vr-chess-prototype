export interface ControlActions {
  onNewGame(): void;
  onUndo(): void;
  onFlip(): void;
}

/** The row of buttons under the status text. */
export function createControls(actions: ControlActions) {
  const element = document.createElement("div");
  element.className = "controls";

  const newGame = button("New game", actions.onNewGame);
  const undo = button("Undo", actions.onUndo);
  const flip = button("Flip board", actions.onFlip);
  element.append(newGame, undo, flip);

  return {
    element,
    update(canUndo: boolean): void {
      undo.disabled = !canUndo;
    },
  };
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}
