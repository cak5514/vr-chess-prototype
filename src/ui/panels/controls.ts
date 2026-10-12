export interface ControlActions {
  onNewGame(): void;
  onUndo(): void;
  onFlip(): void;
  /** Switch between the flat board and the 3D board. */
  onToggleView(): void;
}

export interface ControlsView {
  canUndo: boolean;
  /** Which board is on screen now. */
  view: "2d" | "3d";
  /** False if this device cannot show the 3D board. */
  canUse3d: boolean;
}

/** The row of buttons under the status text. */
export function createControls(actions: ControlActions) {
  const element = document.createElement("div");
  element.className = "controls";

  const newGame = button("New game", actions.onNewGame);
  const undo = button("Undo", actions.onUndo);
  const flip = button("Flip board", actions.onFlip);
  const view = button("3D board", actions.onToggleView);
  element.append(newGame, undo, flip, view);

  return {
    element,
    update(state: ControlsView): void {
      undo.disabled = !state.canUndo;
      // The button names the board you would switch TO.
      view.textContent = state.view === "2d" ? "3D board" : "2D board";
      view.hidden = !state.canUse3d;
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
