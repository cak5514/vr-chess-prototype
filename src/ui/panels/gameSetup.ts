import { LEVELS, MAX_RATING } from "../../core/index";
import type { Color, LevelId } from "../../core/index";

/**
 * Who the player is up against: the adaptive computer, a fixed computer
 * level, or a friend on the same screen.
 */
export type OpponentChoice = "adaptive" | LevelId | "friend";

export interface GameSetupActions {
  onOpponentChanged(choice: OpponentChoice): void;
  onPlayerColorChanged(color: Color): void;
}

/** The two drop-downs that choose the opponent and which colour you play. */
export function createGameSetup(actions: GameSetupActions, initial: OpponentChoice) {
  const element = document.createElement("section");
  element.className = "game-setup";

  const opponent = document.createElement("select");
  opponent.append(new Option("Computer: Adaptive (recommended)", "adaptive"));
  for (const level of LEVELS) opponent.append(new Option(`Computer: ${level.name}`, level.id));
  opponent.append(new Option("A friend on this screen", "friend"));
  opponent.value = initial;

  const description = document.createElement("p");
  description.className = "setup-description";

  const color = document.createElement("select");
  color.append(new Option("White (moves first)", "white"), new Option("Black", "black"));
  const colorField = field("You play", color);

  let adaptiveRating = 1;

  function refresh(): void {
    const choice = opponent.value as OpponentChoice;
    if (choice === "friend") {
      description.textContent = "Take turns with someone next to you.";
    } else if (choice === "adaptive") {
      description.textContent = `Gets stronger when you win and easier when you struggle. You are on level ${adaptiveRating} of ${MAX_RATING}.`;
    } else {
      description.textContent = LEVELS.find((level) => level.id === choice)?.description ?? "";
    }
    // Choosing a colour only makes sense against the computer.
    colorField.hidden = choice === "friend";
  }

  opponent.addEventListener("change", () => {
    refresh();
    actions.onOpponentChanged(opponent.value as OpponentChoice);
  });
  color.addEventListener("change", () => actions.onPlayerColorChanged(color.value as Color));

  element.append(field("Opponent", opponent), description, colorField);
  refresh();
  return {
    element,
    /** Updates the "level N of 10" text for the adaptive opponent. */
    setAdaptiveRating(rating: number): void {
      adaptiveRating = rating;
      refresh();
    },
  };
}

function field(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "field";
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(text, control);
  return label;
}
