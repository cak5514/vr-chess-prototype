import type { MoveReview } from "../analysis/moveReview";
import { explainMove } from "../hints/hint";
import type { IdeaLabel } from "../model/moveClassifier";

// Commenter mode: after every move the player makes, say how good it was
// and why. Nothing is said before the move.
//
// Three sources are combined here:
//   - the engine's verdict (was the move good, and how much did it cost?)
//   - the trained model's opinion (which idea does the move carry?)
//   - fixed rules that describe what the move visibly does
// The engine always has the final say on whether a move is good. The model
// only names ideas, and only for moves the engine approves of.

/** The rating shown to the player. "sacrifice" is a good move that gives up material. */
export type CommentRating = "sacrifice" | "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface MoveComment {
  ply: number;
  moveNumber: number;
  san: string;
  rating: CommentRating;
  /** The rating in words, e.g. "Best move". */
  ratingLabel: string;
  /** The justification: a few short sentences. */
  text: string[];
  /** Names of the ideas found in the move, for small labels. */
  ideas: string[];
}

const RATING_LABELS: Record<CommentRating, string> = {
  sacrifice: "Sacrifice!",
  best: "Best move",
  good: "Good move",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

/** How each idea from the model is named and explained to a beginner. */
const IDEAS: Partial<Record<IdeaLabel, { name: string; text: string }>> = {
  fork: { name: "Fork", text: "This is a fork: one piece attacks two targets, and your opponent can only save one." },
  pin: {
    name: "Pin",
    text: "This is a pin: the attacked piece cannot move away without exposing something more valuable behind it.",
  },
  skewer: {
    name: "Skewer",
    text: "This is a skewer: a valuable piece is attacked, and when it moves away the piece behind it is lost.",
  },
  discoveredAttack: {
    name: "Discovered attack",
    text: "This is a discovered attack: moving one piece uncovers an attack from the piece behind it.",
  },
  doubleCheck: {
    name: "Double check",
    text: "This is a double check: two pieces give check at once, so the king is forced to move.",
  },
  attraction: { name: "Attraction", text: "This lures an enemy piece onto a square where it is badly placed." },
  deflection: { name: "Deflection", text: "This drags a defender away from the job it was doing." },
  trappedPiece: { name: "Trapped piece", text: "This leaves an enemy piece with no safe square to go to." },
  capturingDefender: {
    name: "Removing the defender",
    text: "This removes the piece that was protecting something else.",
  },
  hangingPiece: { name: "Free piece", text: "This takes a piece that was left undefended." },
  mate: { name: "Checkmate", text: "This is checkmate." },
};

/** The rules' fallback sentence, written for hints, which does not suit a comment. */
const HINT_FALLBACK = "This is a quiet move";

/** Turns a review into the comment the player reads. */
export function commentOn(review: MoveReview): MoveComment {
  const isSound = review.quality === "best" || review.quality === "good";
  const rating: CommentRating = isSound && isSacrifice(review) ? "sacrifice" : review.quality;
  const base = {
    ply: review.ply,
    moveNumber: review.moveNumber,
    san: review.san,
    rating,
    ratingLabel: RATING_LABELS[rating],
  };

  if (!isSound) {
    const text = [review.explanation ?? "There was a stronger move available."];
    // The same act, giving up a piece, is a sacrifice when it works and a
    // blunder when it does not. Say so, because that contrast is the lesson.
    if (review.offered && review.theme !== "allowed-mate") {
      text.push(
        `A sacrifice gives up material to gain something bigger. Here your ${review.offered.piece} is simply lost, with nothing in return.`,
      );
    }
    return { ...base, text, ideas: [] };
  }

  // A sound move: describe what it does, then name any idea the model found.
  const text: string[] = [];
  if (rating === "sacrifice" && review.offered) {
    text.push(
      `You gave up your ${review.offered.piece} on ${review.offered.square} on purpose, and it works: you get more back than you lose.`,
    );
  } else if (rating === "sacrifice") {
    text.push("You gave up material on purpose, and it works: you get more back than you lose.");
  }

  const reasons = (explainMove(review.fenBefore, review.played)?.reasons ?? [])
    .map((reason) => reason.text)
    .filter((sentence) => !sentence.startsWith(HINT_FALLBACK));
  text.push(...reasons.slice(0, 2));

  const ideas = trustedIdeas(review);
  for (const idea of ideas) {
    const known = IDEAS[idea];
    if (!known) continue;
    // Skip the model's sentence if the rules already said the same thing.
    const keyword = known.name.toLowerCase().split(" ")[0];
    const alreadySaid = text.some((sentence) => sentence.toLowerCase().includes(keyword));
    if (!alreadySaid && text.length < 3) text.push(known.text);
  }

  if (text.length === 0) {
    text.push(
      review.quality === "best"
        ? "This is the move the engine would have played. It keeps your position as strong as possible."
        : "A solid, sensible move. Nothing is lost and your position stays healthy.",
    );
  }
  return { ...base, text, ideas: ideas.map((idea) => IDEAS[idea]?.name ?? "").filter(Boolean) };
}

/**
 * A sacrifice is a good move that gives up material. Either the rules saw a
 * piece put at risk, or the trained model recognised the pattern.
 */
function isSacrifice(review: MoveReview): boolean {
  return review.offered !== null || review.ideas.includes("sacrifice");
}

/**
 * The model's ideas, minus the ones we can check and that turned out false.
 * The model sometimes says "mate" for a strong check; the move notation
 * tells us for certain whether it was mate ("#").
 */
function trustedIdeas(review: MoveReview): IdeaLabel[] {
  return review.ideas.filter((idea) => {
    if (idea === "mate") return review.san.endsWith("#");
    if (idea === "doubleCheck") return review.san.endsWith("+") || review.san.endsWith("#");
    // "sacrifice" is shown as the rating itself; these two are too vague to name.
    return idea !== "sacrifice" && idea !== "defensiveMove" && idea !== "quietMove";
  });
}
