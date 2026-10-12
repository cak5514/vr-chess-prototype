import { Chess } from "chess.js";
import type { Move, Square as ChessJsSquare } from "chess.js";
import { findThreatenedPieces } from "../analysis/threats";
import type { ChessEngine, EngineLine } from "../engine/engine";
import type { Color, MoveChoice, PieceType, PromotionPiece, Square } from "../types";
import {
  attackedSquaresFrom,
  fileKind,
  findMateInOne,
  isPassedPawn,
  listInWords,
  materialOf,
  moveInWords,
  passTurn,
  PIECE_NAMES,
  valueOf,
} from "./boardFacts";

/**
 * What a highlight on the board means. Each kind gets its own colour.
 * - "control": squares one of your pieces now covers
 * - "attack":  something of the opponent's you are attacking or taking
 * - "danger":  something of the opponent's that threatens you
 * - "support": one of your own pieces that this move helps
 */
export type MarkKind = "control" | "attack" | "danger" | "support";

export interface SquareMark {
  square: Square;
  kind: MarkKind;
}

export interface ArrowMark {
  from: Square;
  to: Square;
  kind: MarkKind;
}

/** One reason for a move, with the squares and arrows that show it on the board. */
export interface HintReason {
  text: string;
  /** The colour this reason is drawn in, or null if it has nothing to point at. */
  kind: MarkKind | null;
  squares: SquareMark[];
  arrows: ArrowMark[];
}

/** A suggested move with the reasons for it, in plain English. */
export interface Hint {
  move: MoveChoice;
  /** What to do, e.g. "Move your knight from g1 to f3". */
  title: string;
  /** Why it is a good idea, most important reason first. */
  reasons: HintReason[];
}

/** Extra facts that make the explanation better. All optional. */
export interface HintContext {
  /** The engine's analysis of this move, including the moves it expects next. */
  line?: EngineLine;
  /** The move the opponent just played, used to recognise a recapture. */
  lastMove?: { to: Square; captured?: PieceType };
}

/** How far ahead the engine looks for a hint: deeper than any opponent level. */
export const HINT_DEPTH = 12;

/** A hint should stay short, so only the most important reasons are shown. */
const MAX_REASONS = 3;

const PROMOTION_CODES: Record<PromotionPiece, string> = { queen: "q", rook: "r", bishop: "b", knight: "n" };
const CENTRE_SQUARES = ["d4", "e4", "d5", "e5"];
/** Where knights and bishops start the game. */
const MINOR_PIECE_HOMES = ["b1", "g1", "c1", "f1", "b8", "g8", "c8", "f8"];
/** After this many moves the opening is over and "get your pieces out" stops applying. */
const OPENING_MOVES = 12;

/** Asks the engine for its best move and explains it. Null if there is no move. */
export async function findHint(
  engine: ChessEngine,
  fen: string,
  lastMove?: HintContext["lastMove"],
): Promise<Hint | null> {
  // Full strength here: a hint should be the best move, whatever level the opponent plays at.
  const result = await engine.analyse({ fen, depth: HINT_DEPTH, skillLevel: 20, lines: 1 });
  if (!result.bestMove) return null;
  return explainMove(fen, result.bestMove, { line: result.lines[0], lastMove });
}

/** Builds a reason. Squares take the reason's colour; arrows carry their own. */
function reason(
  text: string,
  kind: MarkKind | null = null,
  squares: Square[] = [],
  arrows: ArrowMark[] = [],
): HintReason {
  return { text, kind, squares: kind ? squares.map((square) => ({ square, kind })) : [], arrows };
}

function arrow(from: Square, to: Square, kind: MarkKind): ArrowMark {
  return { from, to, kind };
}

/**
 * Explains a move. The engine decides WHICH move is best; this function
 * works out WHY by checking a list of concrete facts about the position,
 * most important first: forced wins, threats, material, safety, and only
 * then general positional ideas. Every reason also says which squares and
 * arrows to draw, so the player can see what the words mean.
 * Returns null if the move is illegal.
 */
export function explainMove(fen: string, choice: MoveChoice, context: HintContext = {}): Hint | null {
  const before = new Chess(fen);
  const after = new Chess(fen);
  let move: Move;
  try {
    move = after.move({
      from: choice.from,
      to: choice.to,
      promotion: choice.promotion ? PROMOTION_CODES[choice.promotion] : undefined,
    });
  } catch {
    return null;
  }

  const me: Color = move.color === "w" ? "white" : "black";
  const enemy: Color = me === "white" ? "black" : "white";
  const enemyCode = move.color === "w" ? "b" : "w";
  const piece = PIECE_NAMES[move.piece];
  /** What stands on the destination square afterwards (differs after a promotion). */
  const arrived = move.promotion ? PIECE_NAMES[move.promotion] : piece;
  const isCastle = move.isKingsideCastle() || move.isQueensideCastle();
  const myKing = before.findPiece({ type: "k", color: move.color })[0];
  const enemyKing = after.findPiece({ type: "k", color: enemyCode })[0];
  const hint: Hint = { move: choice, title: describeAction(move, piece), reasons: [] };

  if (after.isCheckmate()) {
    hint.reasons = [
      reason("This is checkmate! The enemy king is attacked and has no way to escape.", "attack", [enemyKing]),
    ];
    return hint;
  }

  const myThreatsBefore = findThreatenedPieces(fen, me);
  const myThreatsAfter = findThreatenedPieces(move.after, me);
  const enemyThreatsBefore = findThreatenedPieces(fen, enemy);
  const enemyThreatsAfter = findThreatenedPieces(move.after, enemy);
  const reasons: HintReason[] = [];

  // ---------- 1. Forced wins and emergencies ----------

  const mateIn = context.line?.mateIn;
  if (mateIn !== undefined && mateIn > 1) {
    reasons.push(
      reason(`It starts a forced checkmate. Played correctly, you win in ${mateIn} moves whatever your opponent does.`),
    );
  }

  if (before.inCheck()) {
    const checkers = before.attackers(myKing, enemyCode).map((square) => arrow(square, myKing, "danger"));
    let text = "You are in check, and this blocks the attack on your king.";
    if (piece === "king") text = "You are in check, and this moves your king to a safe square.";
    else if (move.captured) text = "You are in check, and this captures the piece attacking your king.";
    reasons.push(reason(text, "danger", [], checkers));
  } else {
    // Would the opponent have had checkmate if we had done nothing?
    const threat = findMateInOne(passTurn(fen));
    if (threat && !findMateInOne(move.after)) {
      reasons.push(
        reason(`It stops checkmate. Your opponent was threatening ${moveInWords(threat)}.`, "danger", [], [
          arrow(threat.from, threat.to, "danger"),
        ]),
      );
    }
  }

  // ---------- 2. Winning material ----------

  if (move.captured) {
    const captured = PIECE_NAMES[move.captured];
    const isDefended = before.attackers(move.to, enemyCode).length > 0;
    const isRecapture = context.lastMove?.captured !== undefined && context.lastMove.to === move.to;

    let text = `It captures the ${captured} on ${move.to}.`;
    if (isRecapture) {
      text = `It takes back on ${move.to}. Your opponent just captured there, and this wins the material back.`;
    } else if (!isDefended && !move.isEnPassant()) {
      text = `It captures the ${captured} on ${move.to} for free, because nothing defends it.`;
    } else if (valueOf(captured) > valueOf(piece)) {
      text = `It captures a ${captured} with a ${piece}, winning the more valuable piece.`;
    } else if (valueOf(captured) === valueOf(piece)) {
      const lead = materialOf(before, move.color) - materialOf(before, enemyCode);
      const whyTrade = lead >= 2 ? " You are ahead, and each trade makes that lead count for more." : "";
      text = `It trades your ${piece} for their ${captured}, an even exchange.${whyTrade}`;
    }
    reasons.push(reason(text, "attack", [move.to]));
  }
  if (move.promotion) {
    reasons.push(
      reason(`Your pawn reaches the last row and becomes a ${arrived}, your strongest possible upgrade.`, "support", [
        move.to,
      ]),
    );
  }

  // ---------- 3. Threats this move creates ----------

  // A fork: the moved piece now attacks two or more things worth taking.
  const forkTargets = attackedSquaresFrom(after, move.to)
    .map((square) => ({ square, target: after.get(square as ChessJsSquare) }))
    .filter(({ square, target }) => {
      if (!target || target.color === move.color) return false;
      if (target.type === "k") return true;
      // Attacking two pawns is not much of a threat, so pawns do not count.
      if (target.type === "p") return false;
      const targetName = PIECE_NAMES[target.type];
      const undefended = after.attackers(square as ChessJsSquare, enemyCode).length === 0;
      return undefended || valueOf(targetName) > valueOf(arrived);
    })
    .map(({ square, target }) => ({ square, piece: PIECE_NAMES[target!.type] }))
    .sort((a, b) => valueOf(b.piece) - valueOf(a.piece));
  const isFork = forkTargets.length >= 2;

  if (isFork) {
    const [first, second] = forkTargets;
    reasons.push(
      reason(
        `It attacks two things at once: the ${first.piece} on ${first.square} and the ${second.piece} on ${second.square}. ` +
          "Your opponent can only save one. This is called a fork.",
        "attack",
        [first.square, second.square],
        [arrow(move.to, first.square, "attack"), arrow(move.to, second.square, "attack")],
      ),
    );
  } else if (after.inCheck()) {
    const movedPieceGivesCheck = forkTargets.some((target) => target.piece === "king");
    const checkers = after.attackers(enemyKing, move.color).map((square) => arrow(square, enemyKing, "attack"));
    reasons.push(
      reason(
        movedPieceGivesCheck
          ? "It gives check, so your opponent must deal with that before anything else."
          : `It moves your ${piece} out of the way so the piece behind it gives check. This is called a discovered check.`,
        "attack",
        [enemyKing],
        checkers,
      ),
    );
  }

  if (!after.inCheck()) {
    const mate = findMateInOne(passTurn(move.after));
    if (mate) {
      reasons.push(
        reason(`It threatens checkmate on your next move: ${moveInWords(mate)}.`, "attack", [enemyKing], [
          arrow(mate.from, mate.to, "attack"),
        ]),
      );
    }
  }

  if (!isFork) {
    const newTarget = enemyThreatsAfter.find(
      (threat) => !enemyThreatsBefore.some((old) => old.square === threat.square),
    );
    if (newTarget) {
      const why =
        newTarget.kind === "hanging"
          ? "which nothing defends"
          : `which is worth more than your ${newTarget.attacker}`;
      reasons.push(
        reason(`It attacks the ${newTarget.piece} on ${newTarget.square}, ${why}.`, "attack", [newTarget.square], [
          arrow(newTarget.attackerSquare, newTarget.square, "attack"),
        ]),
      );
    }
  }

  // ---------- 4. Keeping your own pieces safe ----------

  const danger = myThreatsBefore.find((threat) => threat.square === move.from);
  const stillInDanger = myThreatsAfter.some((threat) => threat.square === move.to);
  if (danger && !stillInDanger) {
    reasons.push(
      reason(
        `Your ${piece} was attacked by the ${danger.attacker} on ${danger.attackerSquare}. This moves it to safety.`,
        "danger",
        [danger.attackerSquare],
        [arrow(danger.attackerSquare, move.from, "danger")],
      ),
    );
  }

  const rescued = myThreatsBefore.find(
    (threat) => threat.square !== move.from && !myThreatsAfter.some((now) => now.square === threat.square),
  );
  // If we captured the attacker, "it captures" above already says enough.
  if (rescued && rescued.attackerSquare !== move.to) {
    const target = rescued.square as ChessJsSquare;
    const oldDefenders = before.attackers(target, move.color);
    const newDefenders = after.attackers(target, move.color).filter((square) => !oldDefenders.includes(square));
    reasons.push(
      reason(
        `It defends your ${rescued.piece} on ${rescued.square}, which was attacked by the ${rescued.attacker} on ${rescued.attackerSquare}.`,
        "support",
        [rescued.square],
        [
          ...newDefenders.map((square) => arrow(square, rescued.square, "support")),
          arrow(rescued.attackerSquare, rescued.square, "danger"),
        ],
      ),
    );
  }

  // ---------- 5. The engine's plan ----------

  const plan = describePlan(move.after, context.line, mateIn);
  if (plan) reasons.push(plan);

  // ---------- 6. Positional ideas, each tied to this exact position ----------

  if (isCastle) {
    reasons.push(
      reason(
        "Castling moves your king behind its pawns, away from the open centre, and brings the rook towards the middle where it can join in.",
      ),
    );
  }

  const isOpening = before.moveNumber() <= OPENING_MOVES;
  if ((piece === "knight" || piece === "bishop") && MINOR_PIECE_HOMES.includes(move.from) && isOpening) {
    reasons.push(describeDevelopment(before, after, move, piece));
  }

  if (piece === "pawn" && !move.captured) {
    if (CENTRE_SQUARES.includes(move.to)) {
      const controlled = attackedSquaresFrom(after, move.to);
      reasons.push(
        reason(
          `It puts a pawn on ${move.to}, which controls ${listInWords(controlled)} and claims space in the centre.`,
          "control",
          controlled,
        ),
      );
    }
    const opened = pieceWithNewPath(before, after, move);
    if (opened) {
      reasons.push(
        reason(`It opens a path for your ${opened.piece} on ${opened.square}.`, "support", [
          opened.square,
          ...opened.newSquares,
        ]),
      );
    }

    const rank = Number(move.to[1]);
    const isAdvanced = me === "white" ? rank >= 5 : rank <= 4;
    if (isAdvanced && isPassedPawn(after, move.to)) {
      reasons.push(
        reason(
          "No enemy pawn can block or capture this pawn any more. Each step brings it closer to becoming a queen.",
          "control",
          squaresAhead(move.to, me),
        ),
      );
    }
  }

  if (piece === "rook" && move.from[0] !== move.to[0]) {
    const kind = fileKind(after, move.to[0], move.color);
    const alongFile = attackedSquaresFrom(after, move.to).filter((square) => square[0] === move.to[0]);
    if (kind === "open") {
      reasons.push(
        reason(`It puts your rook on the open ${move.to[0]}-file, where no pawns block its path.`, "control", alongFile),
      );
    } else if (kind === "half-open") {
      reasons.push(
        reason(
          `It puts your rook on the ${move.to[0]}-file, where none of your own pawns are in its way.`,
          "control",
          alongFile,
        ),
      );
    }
  }

  const queensLeft = after.findPiece({ type: "q", color: "w" }).length + after.findPiece({ type: "q", color: "b" }).length;
  if (piece === "king" && !isCastle && !before.inCheck() && queensLeft === 0) {
    reasons.push(
      reason(
        "With the queens gone, your king is in far less danger and becomes a useful piece. Bring it towards the action.",
      ),
    );
  }

  // The rest is only worth saying when nothing more specific was found.
  if (reasons.length === 0 && piece === "pawn") {
    const guarded = attackedSquaresFrom(after, move.to);
    if (guarded.length > 0) {
      reasons.push(
        reason(`It guards ${listInWords(guarded)}, so enemy pieces cannot settle there.`, "control", guarded),
      );
    }
  }
  if (reasons.length === 0 && piece !== "pawn" && piece !== "king") {
    const reachBefore = attackedSquaresFrom(before, move.from).length;
    const reach = attackedSquaresFrom(after, move.to);
    if (reach.length >= reachBefore + 3) {
      reasons.push(
        reason(
          `From ${move.to} your ${piece} reaches ${reach.length} squares, up from ${reachBefore} where it was.`,
          "control",
          reach,
        ),
      );
    }
  }

  if (reasons.length === 0) {
    reasons.push(
      reason(
        "This is a quiet move that improves your position slightly. No single reason stands out, but the engine found nothing better.",
      ),
    );
  }
  hint.reasons = reasons.slice(0, MAX_REASONS);
  return hint;
}

function describeAction(move: Move, piece: PieceType): string {
  if (move.isKingsideCastle()) return "Castle on the king's side";
  if (move.isQueensideCastle()) return "Castle on the queen's side";
  return `Move your ${piece} from ${move.from} to ${move.to}`;
}

/**
 * Looks at the next two moves the engine expects (the opponent's reply and
 * our follow-up) and mentions them when the follow-up wins something.
 */
function describePlan(fenAfter: string, line: EngineLine | undefined, mateIn: number | undefined): HintReason | null {
  // A forced mate has already been announced; the plan would repeat it.
  if (!line || line.pv.length < 3 || (mateIn !== undefined && mateIn > 0)) return null;

  const chess = new Chess(fenAfter);
  try {
    const reply = chess.move(toChessJs(line.pv[1]));
    const fenBeforeFollowUp = chess.fen();
    const followUp = chess.move(toChessJs(line.pv[2]));
    if (!followUp.captured) return null;
    // Taking back after the opponent captures only keeps things level.
    if (reply.captured && reply.to === followUp.to) return null;

    const captured = PIECE_NAMES[followUp.captured];
    const defenders = new Chess(fenBeforeFollowUp).attackers(followUp.to, reply.color).length;
    const winsMaterial = defenders === 0 || valueOf(captured) > valueOf(PIECE_NAMES[followUp.piece]);
    if (!winsMaterial) return null;

    return reason(
      `The idea: if your opponent replies with ${moveInWords(reply)}, you can win material with ${moveInWords(followUp)}.`,
      "attack",
      [],
      [arrow(reply.from, reply.to, "danger"), arrow(followUp.from, followUp.to, "attack")],
    );
  } catch {
    // The engine's line did not fit the position; just skip the plan.
    return null;
  }
}

function toChessJs(move: MoveChoice) {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion ? PROMOTION_CODES[move.promotion] : undefined,
  };
}

/** Explains bringing out a knight or bishop by what it does on its new square. */
function describeDevelopment(before: Chess, after: Chess, move: Move, piece: PieceType): HintReason {
  const reach = attackedSquaresFrom(after, move.to);
  let text: string;
  let squares: Square[];

  if (piece === "knight") {
    const centre = reach.filter((square) => CENTRE_SQUARES.includes(square));
    squares = centre;
    text =
      centre.length > 0
        ? `From ${move.to} your knight controls the centre ${centre.length === 1 ? "square" : "squares"} ${listInWords(centre)}.`
        : `It brings your knight into play on ${move.to}.`;
  } else {
    squares = reach;
    text = `It brings your bishop into play. From ${move.to} it reaches ${reach.length} squares instead of being shut in behind its pawns.`;
  }

  // Did this move empty the last square between the king and the rook?
  const row = move.color === "w" ? "1" : "8";
  const between = [`f${row}`, `g${row}`] as ChessJsSquare[];
  const clearNow = between.every((square) => !after.get(square));
  const clearBefore = between.every((square) => !before.get(square));
  if (clearNow && !clearBefore && after.getCastlingRights(move.color).k) {
    text += " It also clears the way for you to castle.";
  }
  return reason(text, "control", squares);
}

/** After a pawn move, finds a bishop, rook or queen that can now reach clearly more squares. */
function pieceWithNewPath(
  before: Chess,
  after: Chess,
  move: Move,
): { piece: PieceType; square: Square; newSquares: Square[] } | null {
  let best: { piece: PieceType; square: Square; newSquares: Square[] } | null = null;
  for (const row of after.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== move.color || !"brq".includes(cell.type)) continue;
      const old = attackedSquaresFrom(before, cell.square);
      const newSquares = attackedSquaresFrom(after, cell.square).filter((square) => !old.includes(square));
      if (newSquares.length >= 2 && (!best || newSquares.length > best.newSquares.length)) {
        best = { piece: PIECE_NAMES[cell.type], square: cell.square, newSquares };
      }
    }
  }
  return best;
}

/** The squares in front of a pawn, up to the row where it promotes. */
function squaresAhead(square: Square, color: Color): Square[] {
  const step = color === "white" ? 1 : -1;
  const ahead: Square[] = [];
  for (let rank = Number(square[1]) + step; rank >= 1 && rank <= 8; rank += step) {
    ahead.push(`${square[0]}${rank}`);
  }
  return ahead;
}
