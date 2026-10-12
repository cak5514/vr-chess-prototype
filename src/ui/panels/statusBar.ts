import type { Color, Position } from "../../core/index";

/** Extra facts the status text needs besides the position itself. */
export interface StatusContext {
  /** The colour the human plays against the computer, or null with two humans. */
  playerColor: Color | null;
  /** Set when the computer opponent could not start. */
  engineError: boolean;
}

interface StatusText {
  headline: string;
  detail: string;
}

function name(color: Color): string {
  return color === "white" ? "White" : "Black";
}

/** Explains the state of the game in words a first-time player understands. */
export function describeStatus(position: Position, context: StatusContext): StatusText {
  const { playerColor } = context;
  const playersTurn = position.turn === playerColor;

  switch (position.status) {
    case "checkmate": {
      const winner =
        playerColor === null
          ? `${name(position.winner!)} wins.`
          : position.winner === playerColor
            ? "You win!"
            : "The computer wins.";
      return {
        headline: `Checkmate! ${winner}`,
        detail: "The king is attacked and has no way to escape.",
      };
    }
    case "stalemate":
      return {
        headline: "Stalemate. The game is a draw.",
        detail: `${name(position.turn)} has no legal move but is not in check.`,
      };
    case "draw":
      return { headline: "Draw.", detail: describeDraw(position) };
    case "playing":
      break;
  }

  if (context.engineError) {
    return {
      headline: "The computer opponent could not start.",
      detail: "Reload the page, or choose “A friend on this screen” to keep playing.",
    };
  }

  if (playerColor === null) {
    return position.inCheck
      ? { headline: `${name(position.turn)} is in check!`, detail: CHECK_ADVICE }
      : { headline: `${name(position.turn)} to move`, detail: "" };
  }
  if (playersTurn) {
    return position.inCheck
      ? { headline: "You are in check!", detail: CHECK_ADVICE }
      : { headline: "Your turn", detail: `You are playing ${name(playerColor).toLowerCase()}.` };
  }
  return { headline: "The computer is thinking…", detail: "" };
}

const CHECK_ADVICE = "The king is attacked. Move it, block the attack, or capture the attacker.";

function describeDraw(position: Position): string {
  switch (position.drawReason) {
    case "insufficient-material":
      return "Neither side has enough pieces left to give checkmate.";
    case "threefold-repetition":
      return "The same position has appeared three times.";
    default:
      return "Fifty moves have passed without a capture or a pawn move.";
  }
}

export function createStatusBar() {
  const element = document.createElement("div");
  element.className = "status";
  // Screen readers announce changes to this text.
  element.setAttribute("aria-live", "polite");

  const headline = document.createElement("p");
  headline.className = "status-headline";
  const detail = document.createElement("p");
  detail.className = "status-detail";
  element.append(headline, detail);

  return {
    element,
    update(position: Position, context: StatusContext): void {
      const text = describeStatus(position, context);
      const playing = position.status === "playing";
      headline.textContent = text.headline;
      detail.textContent = text.detail;
      element.classList.toggle("status-over", !playing);
      element.classList.toggle("status-check", playing && position.inCheck);
      element.classList.toggle("status-error", playing && context.engineError);
    },
  };
}
