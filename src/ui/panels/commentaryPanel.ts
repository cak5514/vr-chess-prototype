import type { CommentRating, MoveComment } from "../../core/index";
import { createTickScale } from "./tickScale";

/** How many earlier comments to keep on screen below the newest one. */
const MAX_EARLIER = 30;

/** The ratings from worst to best: the order of the ticks on the rating scale. */
const RATING_ORDER: CommentRating[] = ["blunder", "mistake", "inaccuracy", "good", "best"];

/** Where a rating sits on the scale. A sound sacrifice is as good as the best move, so it shares the top tick. */
function scalePlace(rating: CommentRating): number {
  return rating === "sacrifice" ? RATING_ORDER.length - 1 : RATING_ORDER.indexOf(rating);
}

/**
 * Commenter mode: after each move the player makes, shows a rating and the
 * reasons for it. The newest comment is large; earlier ones are listed below.
 */
export function createCommentaryPanel() {
  const element = document.createElement("section");
  element.className = "commentary";

  const title = document.createElement("h2");
  title.textContent = "Commentary";
  const body = document.createElement("div");
  body.className = "commentary-body";
  // Screen readers announce each new comment.
  body.setAttribute("aria-live", "polite");
  element.append(title, body);

  return {
    element,
    /**
     * `comments` are in the order the moves were played.
     * `thinking` is true while the latest move is still being checked.
     */
    update(visible: boolean, comments: MoveComment[], thinking: boolean): void {
      element.hidden = !visible;
      if (!visible) return;

      const parts: HTMLElement[] = [];
      if (thinking) {
        const waiting = document.createElement("p");
        waiting.className = "commentary-waiting";
        waiting.textContent = "Looking at your move…";
        parts.push(waiting);
      }

      const newestFirst = [...comments].reverse();
      if (newestFirst.length === 0 && !thinking) {
        const empty = document.createElement("p");
        empty.className = "commentary-empty";
        empty.textContent = "Make a move. I will tell you how good it was and why.";
        parts.push(empty);
      }
      if (newestFirst.length > 0) parts.push(newestComment(newestFirst[0]));

      const earlier = newestFirst.slice(1, 1 + MAX_EARLIER);
      if (earlier.length > 0) {
        const list = document.createElement("ol");
        list.className = "commentary-earlier";
        list.append(...earlier.map(earlierComment));
        parts.push(list);
      }
      body.replaceChildren(...parts);
    },
  };

  /** The latest comment: the rating in large type, its place on the scale, and the full reasons. */
  function newestComment(comment: MoveComment): HTMLElement {
    const card = document.createElement("article");
    card.className = `comment comment-newest comment-${comment.rating}`;

    const head = document.createElement("div");
    head.className = "comment-head";
    const words = document.createElement("div");
    const move = document.createElement("p");
    move.className = "comment-move";
    move.textContent = `Move ${comment.moveNumber}, ${comment.san}`;
    const rating = document.createElement("p");
    rating.className = "comment-rating";
    rating.textContent = comment.ratingLabel;
    words.append(move, rating);

    head.append(words);
    card.append(head);

    if (comment.ideas.length > 0) card.append(ideaLabels(comment.ideas));
    for (const sentence of comment.text) {
      const line = document.createElement("p");
      line.className = "comment-text";
      line.textContent = sentence;
      card.append(line);
    }
    return card;
  }
}

/** An earlier comment: one row with the move, its rating and the first reason. */
function earlierComment(comment: MoveComment): HTMLElement {
  const row = document.createElement("li");
  row.className = `comment comment-${comment.rating}`;

  const head = document.createElement("p");
  head.className = "comment-head";
  const move = document.createElement("span");
  move.className = "comment-move";
  move.textContent = `${comment.moveNumber}. ${comment.san}`;
  const rating = document.createElement("strong");
  rating.className = "comment-rating";
  rating.textContent = comment.ratingLabel;
  head.append(move, rating);

  const line = document.createElement("p");
  line.className = "comment-text";
  line.textContent = comment.text[0] ?? "";
  row.append(head, line);
  return row;
}

function ideaLabels(names: string[]): HTMLElement {
  const ideas = document.createElement("p");
  ideas.className = "comment-ideas";
  for (const name of names) {
    const chip = document.createElement("span");
    chip.textContent = name;
    ideas.append(chip);
  }
  return ideas;
}

/**
 * The verdict line pinned at the foot of the panel: the rating of the last
 * move, marked on the engraved scale. It stays in view whatever the panel
 * above it is showing.
 */
export function createVerdict() {
  const element = document.createElement("div");
  element.className = "verdict";

  const words = document.createElement("p");
  words.className = "verdict-words";
  const move = document.createElement("span");
  move.className = "verdict-move";
  const rating = document.createElement("strong");
  words.append(move, rating);

  // Made once, so the marker slides from one rating to the next.
  const scale = createTickScale(RATING_ORDER.length, "scale-rating", { start: "Blunder", end: "Best" });
  element.append(words, scale.element);

  return {
    element,
    /** Shows the latest comment's rating, or hides the line when there is none. */
    update(comment: MoveComment | null): void {
      element.hidden = comment === null;
      if (!comment) return;
      element.className = `verdict comment-${comment.rating}`;
      move.textContent = `Move ${comment.moveNumber}, ${comment.san}`;
      rating.textContent = comment.ratingLabel;
      scale.update(scalePlace(comment.rating), `Rated ${comment.ratingLabel}`);
    },
  };
}
