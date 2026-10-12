import type { GameSummary, MoveReview, RatingChange } from "../../core/index";

export interface SummaryActions {
  onPlayAgain(): void;
}

const QUALITY_LABELS: Record<string, string> = {
  blunder: "Blunder",
  mistake: "Mistake",
  inaccuracy: "Inaccuracy",
};

/** The post-game feedback card: result, numbers, mistakes and advice. */
export function createGameSummary(actions: SummaryActions) {
  const element = document.createElement("section");
  element.className = "summary";
  element.hidden = true;

  return {
    element,
    /**
     * Shows the summary, or hides it when `summary` is null.
     * `pendingReviews` is how many moves the engine is still checking.
     */
    update(summary: GameSummary | null, pendingReviews: number, levelChange: RatingChange | null = null): void {
      element.hidden = summary === null;
      if (!summary) return;

      const heading = document.createElement("h2");
      heading.textContent = "Game summary";
      const result = document.createElement("p");
      result.className = `summary-result result-${summary.result}`;
      result.textContent = summary.resultText;

      const stats = document.createElement("dl");
      stats.className = "summary-stats";
      stats.append(
        ...stat("Your moves", String(summary.playerMoves)),
        ...stat("Pieces you captured", String(summary.capturesByPlayer)),
        ...stat("Pieces you lost", String(summary.capturesByOpponent)),
        ...stat("Good moves", summary.goodMovePercent === null ? "–" : `${summary.goodMovePercent}%`),
      );

      const counts = document.createElement("p");
      counts.className = "summary-counts";
      const { blunder, mistake, inaccuracy } = summary.counts;
      counts.textContent = `${plural(blunder, "blunder")}, ${plural(mistake, "mistake")}, ${plural(inaccuracy, "inaccuracy", "inaccuracies")}`;

      const parts: HTMLElement[] = [heading, result, stats, counts];

      if (pendingReviews > 0) {
        const pending = document.createElement("p");
        pending.className = "summary-pending";
        pending.textContent = `Still checking ${plural(pendingReviews, "move")}…`;
        parts.push(pending);
      }

      if (summary.keyMistakes.length > 0) {
        parts.push(subheading("Moves to learn from"));
        const list = document.createElement("ul");
        list.className = "summary-mistakes";
        list.append(...summary.keyMistakes.map(mistakeItem));
        parts.push(list);
      }

      parts.push(subheading("For your next game"));
      const advice = document.createElement("ul");
      advice.className = "summary-advice";
      for (const text of summary.recommendations) {
        const item = document.createElement("li");
        item.textContent = text;
        advice.append(item);
      }
      parts.push(advice);

      // Against the adaptive opponent: say how the level changed and why.
      if (levelChange) {
        const level = document.createElement("p");
        level.className = "summary-level";
        const moved =
          levelChange.after === levelChange.before
            ? `Level ${levelChange.after}`
            : `Level ${levelChange.before} → ${levelChange.after}`;
        level.textContent = `${moved}. ${levelChange.reason}`;
        parts.push(level);
      }

      const again = document.createElement("button");
      again.type = "button";
      again.className = "primary";
      again.textContent = "Play again";
      again.addEventListener("click", actions.onPlayAgain);
      parts.push(again);

      element.replaceChildren(...parts);
    },
  };
}

function stat(label: string, value: string): HTMLElement[] {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value;
  return [term, detail];
}

function subheading(text: string): HTMLElement {
  const el = document.createElement("h3");
  el.textContent = text;
  return el;
}

function mistakeItem(review: MoveReview): HTMLElement {
  const item = document.createElement("li");
  const title = document.createElement("strong");
  title.textContent = `Move ${review.moveNumber}, ${review.san}: ${QUALITY_LABELS[review.quality] ?? ""}`;
  const text = document.createElement("span");
  text.textContent = review.explanation ?? "";
  item.append(title, text);
  return item;
}

function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}
