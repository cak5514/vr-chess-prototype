import type { MoveRecord, MoveReview } from "../../core/index";

// The marks chess books put after a move: ?! dubious, ? mistake, ?? blunder.
const QUALITY_MARKS: Record<string, string> = {
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

/** The list of moves played, one row per turn: "1.  e4  e5". */
export function createMoveList() {
  const element = document.createElement("section");
  element.className = "move-list";

  const title = document.createElement("h2");
  title.textContent = "Moves";
  const empty = document.createElement("p");
  empty.className = "move-list-empty";
  empty.textContent = "No moves yet. White goes first.";
  const rows = document.createElement("ol");
  element.append(title, empty, rows);

  return {
    element,
    /** `reviews` adds the usual chess marks after moves that were errors. */
    update(history: MoveRecord[], reviews: MoveReview[] = []): void {
      empty.hidden = history.length > 0;
      const reviewAt = new Map(reviews.map((review) => [review.ply, review]));

      const moveCell = (ply: number): HTMLElement => {
        const move = history[ply];
        if (!move) return cell("move", "");
        const quality = reviewAt.get(ply)?.quality;
        const mark = quality ? (QUALITY_MARKS[quality] ?? "") : "";
        const el = cell(`move${mark ? ` move-${quality}` : ""}`, move.san + mark);
        if (mark) el.title = quality!;
        return el;
      };

      const items: HTMLElement[] = [];
      // Two moves per row: white's, then black's reply.
      for (let i = 0; i < history.length; i += 2) {
        const row = document.createElement("li");
        row.append(cell("move-number", `${i / 2 + 1}.`), moveCell(i), moveCell(i + 1));
        items.push(row);
      }
      rows.replaceChildren(...items);
      // Keep the newest move in view.
      rows.scrollTop = rows.scrollHeight;
    },
  };
}

function cell(className: string, text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}
