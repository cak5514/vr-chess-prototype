// The engraved scale: a row of short ticks with one lit marker, like the
// level meter on a piece of audio equipment. It is used wherever the site
// shows a position on a range: the opponent's level, how good a move was,
// and how far through a lesson the learner is.
//
// The marker slides to its new place when the value changes. Its position
// is also described in words for screen readers.

export interface TickScale {
  element: HTMLElement;
  /**
   * Moves the marker. `lit` counts from 0; null hides the marker.
   * `description` is read aloud, e.g. "Level 3 of 10".
   */
  update(lit: number | null, description: string): void;
}

/** Words engraved at the two ends of a scale, e.g. "1" and "10". */
export interface ScaleEnds {
  start: string;
  end: string;
}

export function createTickScale(count: number, className = "", ends?: ScaleEnds): TickScale {
  const element = document.createElement("span");
  element.className = `scale ${className}`.trim();
  // To a screen reader the whole scale is one picture with a description.
  element.setAttribute("role", "img");

  const ticks = document.createElement("span");
  ticks.className = "scale-ticks";
  for (let i = 0; i < count; i++) ticks.append(document.createElement("i"));

  const marker = document.createElement("span");
  marker.className = "scale-marker";
  // The marker sits inside the row of ticks, so it is measured from the first tick.
  ticks.append(marker);

  const label = (text: string) => {
    const el = document.createElement("span");
    el.className = "scale-end";
    el.textContent = text;
    return el;
  };
  if (ends) element.append(label(ends.start), ticks, label(ends.end));
  else element.append(ticks);

  return {
    element,
    update(lit, description) {
      element.setAttribute("aria-label", description);
      marker.hidden = lit === null;
      // CSS turns this number into the marker's position.
      if (lit !== null) element.style.setProperty("--lit", String(Math.max(0, Math.min(count - 1, lit))));
    },
  };
}
