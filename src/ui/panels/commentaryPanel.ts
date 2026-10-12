import type { MoveComment } from "../../core/index";

/** How many earlier comments to keep on screen below the newest one. */
const MAX_EARLIER = 30;

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
      if (newestFirst.length > 0) parts.push(commentCard(newestFirst[0], true));

      const earlier = newestFirst.slice(1, 1 + MAX_EARLIER);
      if (earlier.length > 0) {
        const list = document.createElement("div");
        list.className = "commentary-earlier";
        list.append(...earlier.map((comment) => commentCard(comment, false)));
        parts.push(list);
      }
      body.replaceChildren(...parts);
    },
  };
}

function commentCard(comment: MoveComment, isNewest: boolean): HTMLElement {
  const card = document.createElement("article");
  card.className = `comment comment-${comment.rating}${isNewest ? " comment-newest" : ""}`;

  const head = document.createElement("p");
  head.className = "comment-head";
  const move = document.createElement("span");
  move.className = "comment-move";
  move.textContent = `${comment.moveNumber}. ${comment.san}`;
  const rating = document.createElement("strong");
  rating.className = "comment-rating";
  rating.textContent = comment.ratingLabel;
  head.append(move, rating);
  card.append(head);

  if (comment.ideas.length > 0) {
    const ideas = document.createElement("p");
    ideas.className = "comment-ideas";
    for (const name of comment.ideas) {
      const chip = document.createElement("span");
      chip.textContent = name;
      ideas.append(chip);
    }
    card.append(ideas);
  }

  // Earlier comments show only their first sentence, to keep the list short.
  for (const sentence of isNewest ? comment.text : comment.text.slice(0, 1)) {
    const line = document.createElement("p");
    line.className = "comment-text";
    line.textContent = sentence;
    card.append(line);
  }
  return card;
}
