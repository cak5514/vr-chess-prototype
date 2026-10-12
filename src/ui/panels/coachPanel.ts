import type { Candidate, CandidateGroup } from "../../core/index";

export interface CoachActions {
  /** The player is looking at a move (hovering or focusing it), or has stopped (null). */
  onPreview(candidate: Candidate | null): void;
  /** The player picked this move to play. */
  onChoose(candidate: Candidate): void;
}

/** What the coach panel should show right now. */
export interface CoachView {
  /** The panel is only shown in Coach mode. */
  visible: boolean;
  /** False when it is not the player's turn or the game is over. */
  playersTurn: boolean;
  /** True while the engine is still working out the options. */
  loading: boolean;
  groups: CandidateGroup[];
}

// How ideas from the trained model are named on the small labels.
const IDEA_NAMES: Record<string, string> = {
  fork: "Fork",
  pin: "Pin",
  skewer: "Skewer",
  discoveredAttack: "Discovered attack",
  doubleCheck: "Double check",
  attraction: "Attraction",
  deflection: "Deflection",
  trappedPiece: "Trapped piece",
  hangingPiece: "Free piece",
  capturingDefender: "Removing the defender",
};

/**
 * Coach mode: before the player moves, lists the sound moves available,
 * grouped by the kind of move. The player picks the idea they prefer.
 */
export function createCoachPanel(actions: CoachActions) {
  const element = document.createElement("section");
  element.className = "coach";

  const title = document.createElement("h2");
  title.textContent = "Coach";
  const intro = document.createElement("p");
  intro.className = "coach-intro";
  const body = document.createElement("div");
  body.className = "coach-body";
  element.append(title, intro, body);

  // Leaving the panel clears the preview from the board.
  element.addEventListener("mouseleave", () => actions.onPreview(null));

  /** Remembers what is on screen, so the list is only rebuilt when it changes. */
  let shown = "";

  return {
    element,
    update(view: CoachView): void {
      element.hidden = !view.visible;
      if (!view.visible) return;

      // Rebuilding the buttons on every redraw would interrupt hovering, so
      // skip it when nothing about the list has changed.
      const key = JSON.stringify([
        view.playersTurn,
        view.loading,
        view.groups.map((group) => group.candidates.map((item) => item.san)),
      ]);
      if (key === shown) return;
      shown = key;

      if (!view.playersTurn) {
        intro.textContent = "Your options will appear here on your turn.";
        body.replaceChildren();
        return;
      }
      if (view.loading) {
        intro.textContent = "Working out your options…";
        body.replaceChildren();
        return;
      }
      if (view.groups.length === 0) {
        intro.textContent = "No suggestions for this position.";
        body.replaceChildren();
        return;
      }

      intro.textContent = "These are all sound moves. Pick the idea you like, or play any move of your own.";
      body.replaceChildren(...view.groups.map(groupSection));
    },
  };

  function groupSection(group: CandidateGroup): HTMLElement {
    const section = document.createElement("div");
    section.className = `coach-group coach-${group.category}`;

    const heading = document.createElement("h3");
    heading.textContent = group.label;
    const description = document.createElement("p");
    description.className = "coach-group-description";
    description.textContent = group.description;
    section.append(heading, description, ...group.candidates.map(candidateButton));
    return section;
  }

  function candidateButton(candidate: Candidate): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "coach-move";

    const name = document.createElement("strong");
    name.textContent = candidate.title;
    const reason = document.createElement("span");
    reason.className = "coach-move-reason";
    reason.textContent = candidate.reason;
    button.append(name, reason);

    const labels = candidate.ideas.map((idea) => IDEA_NAMES[idea]).filter(Boolean);
    if (labels.length > 0) {
      const ideas = document.createElement("span");
      ideas.className = "coach-move-ideas";
      for (const label of labels) {
        const chip = document.createElement("span");
        chip.textContent = label;
        ideas.append(chip);
      }
      button.append(ideas);
    }

    // Looking at a move shows it on the board; clicking plays it.
    button.addEventListener("mouseenter", () => actions.onPreview(candidate));
    button.addEventListener("focus", () => actions.onPreview(candidate));
    button.addEventListener("blur", () => actions.onPreview(null));
    button.addEventListener("click", () => actions.onChoose(candidate));
    return button;
  }
}
