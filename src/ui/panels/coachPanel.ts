import type { Hint } from "../../core/index";

export interface CoachActions {
  onHintRequested(): void;
}

/** What the coach panel should show right now. */
export interface CoachView {
  enabled: boolean;
  /** False when it is not the player's turn or the game is over. */
  canAskForHint: boolean;
  hintLoading: boolean;
  hint: Hint | null;
  /** One sentence per piece that is in danger. */
  warnings: string[];
  /** A comment on the player's last move if it was a mistake, otherwise null. */
  moveNotice: string | null;
}

/** Hints mode: the hint button, warnings about pieces in danger, and notes on mistakes. */
export function createCoachPanel(actions: CoachActions) {
  const element = document.createElement("section");
  element.className = "coach";

  const header = document.createElement("div");
  header.className = "coach-header";
  const title = document.createElement("h2");
  title.textContent = "Hints";
  header.append(title);

  const body = document.createElement("div");
  body.className = "coach-body";

  const notice = document.createElement("p");
  notice.className = "coach-notice";
  notice.setAttribute("role", "status");

  const warnings = document.createElement("ul");
  warnings.className = "coach-warnings";

  const hintButton = document.createElement("button");
  hintButton.type = "button";
  hintButton.className = "primary";
  hintButton.textContent = "Show me a hint";
  hintButton.addEventListener("click", actions.onHintRequested);

  const hintBox = document.createElement("div");
  hintBox.className = "coach-hint";
  // Screen readers announce the hint when it arrives.
  hintBox.setAttribute("aria-live", "polite");

  body.append(notice, warnings, hintButton, hintBox);
  element.append(header, body);

  return {
    element,
    update(view: CoachView): void {
      // The whole panel is only shown in Hints mode.
      element.hidden = !view.enabled;
      if (!view.enabled) return;

      notice.textContent = view.moveNotice ?? "";
      notice.hidden = view.moveNotice === null;

      warnings.replaceChildren(
        ...view.warnings.map((text) => {
          const item = document.createElement("li");
          item.textContent = text;
          return item;
        }),
      );
      warnings.hidden = view.warnings.length === 0;

      hintButton.disabled = !view.canAskForHint || view.hintLoading || view.hint !== null;
      hintButton.textContent = view.hintLoading ? "Thinking of a hint…" : "Show me a hint";

      hintBox.replaceChildren();
      hintBox.hidden = view.hint === null;
      if (view.hint) {
        const action = document.createElement("p");
        action.className = "coach-hint-title";
        action.textContent = `${view.hint.title}.`;
        hintBox.append(action);
        for (const reason of view.hint.reasons) {
          const why = document.createElement("p");
          why.className = "coach-reason";
          // A dot in the same colour as this reason's squares and arrows on the board.
          if (reason.kind) {
            const dot = document.createElement("span");
            dot.className = `reason-dot dot-${reason.kind}`;
            why.append(dot);
          }
          why.append(reason.text);
          hintBox.append(why);
        }
      }
    },
  };
}
