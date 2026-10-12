import type { PieceType, Square } from "../types";

// The tutorial's content. Each lesson is a list of small steps:
// - "info": read an explanation and look at the board
// - "pick": click the right square
// - "move": make a move (or two) that reaches a goal
//
// Positions are written as FEN, the standard one-line notation for a chess
// position. Capital letters are white pieces, small letters are black, and
// numbers are runs of empty squares. In every exercise the learner plays white.

export type LessonId = "board" | "rook" | "bishop" | "queen" | "knight" | "king" | "pawn";

/** What the learner has to achieve in a "move" step. */
export type MoveGoal =
  /** Get a white piece onto `square`. */
  | { type: "reach"; square: Square; maxMoves?: number }
  /** Capture every black piece (kings do not count). */
  | { type: "capture-all"; maxMoves?: number }
  /** Play exactly this move. */
  | { type: "play"; from: Square; to: Square }
  /** Promote a pawn. */
  | { type: "promote" }
  /** Any legal move will do. */
  | { type: "any" };

interface StepBase {
  text: string;
  fen: string;
  /** Squares to highlight. */
  marks?: Square[];
  /** Highlight every square the piece on this square can move to. */
  showMovesOf?: Square;
}

export interface InfoStep extends StepBase {
  kind: "info";
}

export interface PickStep extends StepBase {
  kind: "pick";
  answer: Square;
  success: string;
}

export interface MoveStep extends StepBase {
  kind: "move";
  goal: MoveGoal;
  success: string;
}

export type LessonStep = InfoStep | PickStep | MoveStep;

export interface Lesson {
  id: LessonId;
  title: string;
  summary: string;
  /** The piece this lesson is about, used for its icon. The board lesson has none. */
  piece?: PieceType;
  steps: LessonStep[];
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const EMPTY = "8/8/8/8/8/8/8/8 w - - 0 1";

/** Writes a position with only its piece placement; the rest is always the same. */
function board(placement: string): string {
  return `${placement} w - - 0 1`;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const LESSONS: Lesson[] = [
  {
    id: "board",
    title: "The board",
    summary: "Files, ranks, square names and where the pieces start.",
    steps: [
      {
        kind: "info",
        fen: START,
        text: "Chess is played on a board of 64 squares, 8 across and 8 up. White's pieces start at the bottom and black's at the top. White always moves first.",
      },
      {
        kind: "info",
        fen: EMPTY,
        marks: FILES.map((file) => `${file}4`),
        text: "The rows are called ranks. They are numbered 1 to 8, starting from white's side. The highlighted row is rank 4.",
      },
      {
        kind: "info",
        fen: EMPTY,
        marks: ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"],
        text: "The columns are called files. They are lettered a to h, from left to right. The highlighted column is the e-file.",
      },
      {
        kind: "info",
        fen: EMPTY,
        marks: ["e4"],
        text: "Every square has a name: its file letter, then its rank number. The highlighted square is on the e-file and on rank 4, so it is called e4.",
      },
      {
        kind: "pick",
        fen: EMPTY,
        answer: "d5",
        text: "Your turn. Click the square d5.",
        success: "Correct. File d, rank 5.",
      },
      {
        kind: "pick",
        fen: EMPTY,
        answer: "a1",
        text: "Now click a1, the corner on white's left.",
        success: "Right. Every game starts with a white rook on a1.",
      },
      {
        kind: "pick",
        fen: EMPTY,
        answer: "g7",
        text: "One more. Click g7.",
        success: "Correct. You can now read and name any square on the board.",
      },
      {
        kind: "info",
        fen: START,
        text: "This is the starting position. Rooks stand in the corners, then knights, then bishops. The queen starts on a square of her own colour, with the king beside her. The eight pawns line up in front.",
      },
      {
        kind: "pick",
        fen: START,
        answer: "e1",
        text: "Click the white king.",
        success: "Right, the white king starts on e1. Keeping him safe is the whole point of the game.",
      },
      {
        kind: "pick",
        fen: START,
        answer: "d8",
        text: "Now click the black queen.",
        success: "Correct. She starts on d8, a dark square, because she is the dark queen.",
      },
    ],
  },
  {
    id: "rook",
    title: "The rook",
    summary: "Moves in straight lines.",
    piece: "rook",
    steps: [
      {
        kind: "info",
        fen: board("8/8/8/8/3R4/8/8/8"),
        showMovesOf: "d4",
        text: "The rook moves in straight lines: forward, backward, left or right, as far as it likes. The highlighted squares are everywhere this rook can go.",
      },
      {
        kind: "move",
        fen: board("8/8/8/8/3R4/8/8/8"),
        goal: { type: "reach", square: "d8" },
        text: "Move the rook to the highlighted square. Click the rook and then the square, or drag it there.",
        success: "Well done. The rook crossed four squares in a single move.",
      },
      {
        kind: "info",
        fen: board("8/8/3P4/8/3R2p1/8/8/8"),
        showMovesOf: "d4",
        text: "The rook cannot jump over pieces. It must stop before one of your own pieces. It can capture an enemy piece by landing on its square.",
      },
      {
        kind: "move",
        fen: board("8/8/3P4/8/3R2p1/8/8/8"),
        goal: { type: "capture-all" },
        text: "Capture the black pawn with your rook.",
        success: "Captured. The pawn leaves the board and your rook takes its place.",
      },
      {
        kind: "move",
        fen: board("8/8/8/p3p3/8/8/8/R7"),
        goal: { type: "capture-all", maxMoves: 2 },
        text: "Capture both black pawns. You have two moves.",
        success: "Excellent. A rook is worth about five pawns.",
      },
    ],
  },
  {
    id: "bishop",
    title: "The bishop",
    summary: "Moves diagonally and stays on one colour.",
    piece: "bishop",
    steps: [
      {
        kind: "info",
        fen: board("8/8/8/8/3B4/8/8/8"),
        showMovesOf: "d4",
        text: "The bishop moves diagonally, as far as it likes. Like the rook, it cannot jump over pieces.",
      },
      {
        kind: "move",
        fen: board("8/8/8/8/3B4/8/8/8"),
        goal: { type: "reach", square: "g7" },
        text: "Move the bishop to the highlighted square.",
        success: "Good. That was three squares along the diagonal.",
      },
      {
        kind: "info",
        fen: board("8/8/8/8/3B4/8/8/8"),
        showMovesOf: "d4",
        text: "A bishop never leaves the colour it starts on. This one stands on a dark square, so it can only ever visit dark squares. You start the game with one bishop for each colour.",
      },
      {
        kind: "move",
        fen: board("8/8/5p2/8/3B4/8/8/8"),
        goal: { type: "capture-all" },
        text: "Capture the black pawn.",
        success: "Captured.",
      },
      {
        kind: "move",
        fen: board("8/8/7p/8/5p2/8/8/2B5"),
        goal: { type: "capture-all", maxMoves: 2 },
        text: "Capture both black pawns. You have two moves.",
        success: "Well played. A bishop is worth about three pawns.",
      },
    ],
  },
  {
    id: "queen",
    title: "The queen",
    summary: "The strongest piece: a rook and a bishop in one.",
    piece: "queen",
    steps: [
      {
        kind: "info",
        fen: board("8/8/8/8/3Q4/8/8/8"),
        showMovesOf: "d4",
        text: "The queen is the most powerful piece. She moves like a rook and a bishop combined: in a straight line or diagonally, as far as she likes.",
      },
      {
        kind: "move",
        fen: board("8/8/8/8/3Q4/8/8/8"),
        goal: { type: "reach", square: "h8" },
        text: "Move the queen to the highlighted corner.",
        success: "Good. From the centre she can reach 27 different squares.",
      },
      {
        kind: "move",
        fen: board("8/3p4/8/8/p7/8/8/3Q4"),
        goal: { type: "capture-all", maxMoves: 2 },
        text: "Capture both black pawns. You have two moves, and you will need one straight move and one diagonal move.",
        success: "Excellent. That is the queen using both of her powers.",
      },
      {
        kind: "info",
        fen: board("8/8/8/8/3Q4/8/8/8"),
        text: "A queen is worth about nine pawns, more than any other piece except the king. Losing her for nothing usually loses the game, so always check she is safe before you move.",
      },
    ],
  },
  {
    id: "knight",
    title: "The knight",
    summary: "Moves in an L shape and can jump.",
    piece: "knight",
    steps: [
      {
        kind: "info",
        fen: board("8/8/8/8/3N4/8/8/8"),
        showMovesOf: "d4",
        text: "The knight moves in an L shape: two squares in a straight line, then one square to the side. From the centre it can reach eight squares.",
      },
      {
        kind: "move",
        fen: board("8/8/8/8/3N4/8/8/8"),
        goal: { type: "reach", square: "e6" },
        text: "Move the knight to the highlighted square.",
        success: "Good. Two squares up, one to the right.",
      },
      {
        kind: "info",
        fen: board("8/8/8/8/8/8/PPP5/1N6"),
        showMovesOf: "b1",
        text: "The knight is the only piece that can jump over others. These pawns do not block it at all.",
      },
      {
        kind: "move",
        fen: board("8/8/8/8/8/2p5/PPP5/1N6"),
        goal: { type: "capture-all" },
        text: "Jump over your own pawns and capture the black pawn.",
        success: "Captured. A knight only captures on the square where it lands.",
      },
      {
        kind: "move",
        fen: board("8/8/8/8/8/8/8/N7"),
        goal: { type: "reach", square: "c5", maxMoves: 2 },
        text: "Reach the highlighted square in two moves. Plan the first jump so the second one lands there.",
        success: "Well planned. Knights are tricky, so this takes practice. A knight is worth about three pawns.",
      },
    ],
  },
  {
    id: "king",
    title: "The king",
    summary: "One square at a time, and he must stay safe.",
    piece: "king",
    steps: [
      {
        kind: "info",
        fen: board("8/8/8/8/3K4/8/8/8"),
        showMovesOf: "d4",
        text: "The king moves one square in any direction. He is slow, but he is the most important piece: if he is trapped, the game is lost.",
      },
      {
        kind: "move",
        fen: board("8/8/8/8/3K4/8/8/8"),
        goal: { type: "reach", square: "e5" },
        text: "Move the king to the highlighted square.",
        success: "Good. One step at a time.",
      },
      {
        kind: "info",
        fen: board("4r3/8/8/8/8/8/3K4/8"),
        showMovesOf: "d2",
        text: "The king may never step onto a square where he could be captured. The black rook controls the whole e-file, so the king cannot go there.",
      },
      {
        kind: "move",
        fen: board("4r3/8/8/8/8/8/8/4K3"),
        goal: { type: "any" },
        text: "Check! The rook is attacking your king. When you are in check you must get out of it straight away. Move the king to a safe square.",
        success: "Safe. If a king is in check and has no way out, that is checkmate and the game is over.",
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/4K2R w K - 0 1",
        goal: { type: "play", from: "e1", to: "g1" },
        marks: ["g1"],
        text: "Castling is a special move that tucks the king away. The king moves two squares towards a rook, and the rook jumps to his other side. It is allowed only if neither piece has moved, the squares between them are empty, and the king is not in check. Castle now: move the king two squares to the right.",
        success: "Castled. Your king is safer in the corner and your rook is closer to the centre.",
      },
    ],
  },
  {
    id: "pawn",
    title: "The pawn",
    summary: "Small but full of special rules.",
    piece: "pawn",
    steps: [
      {
        kind: "info",
        fen: board("8/8/8/8/8/8/4P3/8"),
        showMovesOf: "e2",
        text: "Pawns move straight forward, one square at a time. On its very first move, a pawn may go two squares instead.",
      },
      {
        kind: "move",
        fen: board("8/8/8/8/8/8/4P3/8"),
        goal: { type: "reach", square: "e4" },
        text: "Move the pawn two squares forward.",
        success: "Good. This is the most popular first move in chess.",
      },
      {
        kind: "info",
        fen: board("8/8/8/4p3/4P3/8/8/8"),
        text: "Pawns can never move backwards, and they cannot capture straight ahead. This white pawn is blocked by the black pawn in front of it and has no move at all.",
      },
      {
        kind: "move",
        fen: board("8/8/8/3p4/4P3/8/8/8"),
        goal: { type: "capture-all" },
        text: "Pawns capture differently from how they move: one square diagonally forward. Capture the black pawn.",
        success: "Captured. Remember: pawns move straight, but capture diagonally.",
      },
      {
        kind: "move",
        fen: board("8/4P3/8/8/8/8/8/8"),
        goal: { type: "promote" },
        text: "When a pawn reaches the far end of the board it is promoted: it turns into a queen, rook, bishop or knight of your choice. Move the pawn forward and choose a piece.",
        success: "Promoted! Most players choose a queen, because she is the strongest.",
      },
      {
        kind: "move",
        fen: "8/8/8/3pP3/8/8/8/8 w - d6 0 1",
        goal: { type: "capture-all" },
        marks: ["d6"],
        text: "One last special rule, called en passant. If an enemy pawn moves two squares and lands right beside your pawn, you may capture it as if it had moved only one square. The black pawn has just moved from d7 to d5. Capture it by moving your pawn to d6.",
        success: "That is en passant. It must be done on the very next move or the chance is gone. A pawn is worth one point, the unit all other pieces are measured in.",
      },
    ],
  },
];

export function getLesson(id: LessonId): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
