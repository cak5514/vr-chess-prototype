import type { Lesson, LessonStep } from "./lessonTypes";
import { finalPosition, lineSteps } from "./lineBuilder";
import type { Line } from "./lineBuilder";

// Teacher mode: lessons on tactics, checkmates, openings, and gambits and traps.
//
// Two kinds of lesson live here:
// - puzzle lessons, where each step is a position with one idea to find;
// - line lessons, where the learner plays through a sequence of moves and
//   the opponent's replies are scripted (built by lineBuilder.ts).

/** Writes a position from its piece placement, with white to move unless stated. */
function board(placement: string, turn: "w" | "b" = "w"): string {
  return `${placement} ${turn} - - 0 1`;
}

/** The steps for a line, followed by a closing explanation on the final position. */
function lineWithOutro(line: Line, outro: string): LessonStep[] {
  const end = finalPosition(line);
  return [...lineSteps(line), { kind: "info", fen: end.fen, shownMove: end.lastMove, text: outro }];
}

// ---------------------------------------------------------------- Tactics

const FORK: Lesson = {
  id: "fork",
  group: "tactics",
  title: "The fork",
  summary: "One piece attacks two things at once.",
  piece: "knight",
  steps: [
    {
      kind: "info",
      fen: board("r3k3/8/8/3N4/8/8/8/4K3"),
      marks: ["c7"],
      text: "A fork is one piece attacking two enemy pieces at the same time. Your opponent can only save one of them. Knights are the best at it, because nothing can block a knight's attack.",
    },
    {
      kind: "move",
      fen: board("r3k3/8/8/3N4/8/8/8/4K3"),
      goal: { type: "play", from: "d5", to: "c7" },
      text: "Find the fork. Move your knight to the square where it checks the king and attacks the rook.",
      success: "That is a fork. The king must get out of check, and then your knight takes the rook.",
    },
    {
      kind: "move",
      fen: board("4k3/8/2r1n3/8/3P4/8/8/4K3"),
      goal: { type: "play", from: "d4", to: "d5" },
      text: "Even a pawn can fork. Push the pawn so that it attacks the rook and the knight at once.",
      success: "A pawn fork. Whichever piece moves away, the pawn takes the other, and a pawn is worth far less than either.",
    },
    {
      kind: "move",
      fen: board("4k3/8/2p5/n7/8/8/8/3QK3"),
      goal: { type: "play", from: "d1", to: "h5" },
      text: "The queen forks too. Find the check that also attacks the knight on the edge of the board.",
      success: "The king has to move out of check, and then your queen takes the knight for free. Always look at your checks: many of them are forks.",
    },
  ],
};

const PIN: Lesson = {
  id: "pin",
  group: "tactics",
  title: "The pin",
  summary: "A piece that cannot move without exposing what is behind it.",
  piece: "bishop",
  steps: [
    {
      kind: "info",
      fen: board("4k3/8/2n5/1B6/8/8/8/4K3"),
      marks: ["c6", "e8"],
      text: "A pin holds a piece in place. The bishop attacks the knight, and the king stands behind the knight on the same diagonal. If the knight moved, the king would be in check, so the knight is not allowed to move at all.",
    },
    {
      kind: "move",
      fen: board("4k3/8/2n5/8/8/8/8/4KB2"),
      goal: { type: "play", from: "f1", to: "b5" },
      text: "Pin the knight to its king. Move your bishop onto the diagonal that runs through the knight to the king.",
      success: "The knight is pinned. It is stuck there until the king steps aside.",
    },
    {
      kind: "move",
      fen: board("4k3/1p6/2n5/1B6/3P4/8/8/4K3"),
      goal: { type: "play", from: "d4", to: "d5" },
      text: "A pinned piece cannot run away, so attack it again. A pawn defends this knight, so taking it with the bishop would only be an even trade. Attack it with your pawn instead.",
      success: "The knight cannot move, so on your next turn the pawn captures it. Attacking a pinned piece with a pawn is one of the most reliable ways to win material.",
    },
  ],
};

const SKEWER: Lesson = {
  id: "skewer",
  group: "tactics",
  title: "The skewer",
  summary: "Attack a valuable piece to win the one behind it.",
  piece: "rook",
  steps: [
    {
      kind: "info",
      fen: board("8/8/8/R2k3q/8/8/8/4K3", "b"),
      marks: ["d5", "h5"],
      text: "A skewer is a pin turned around: the more valuable piece is in front. Here the rook checks the king. The king has to step off the row, and then the rook captures the queen that was standing behind him.",
    },
    {
      kind: "move",
      fen: board("8/8/8/3k3q/8/8/8/R3K3"),
      goal: { type: "play", from: "a1", to: "a5" },
      text: "Skewer the king and queen. Move your rook to the row they are both standing on.",
      success: "Check. When the king moves away, your rook takes the queen.",
    },
    {
      kind: "move",
      fen: board("7r/8/8/4k3/8/8/8/2B1K3"),
      goal: { type: "play", from: "c1", to: "b2" },
      text: "Bishops skewer along diagonals. Find the check that lines up the king with the rook in the corner.",
      success: "The king must leave the diagonal, and your bishop takes the rook. Look for skewers whenever two enemy pieces stand on one line.",
    },
  ],
};

const DISCOVERED_ATTACK: Lesson = {
  id: "discovered-attack",
  group: "tactics",
  title: "The discovered attack",
  summary: "Move one piece to uncover an attack from another.",
  piece: "knight",
  steps: [
    {
      kind: "info",
      fen: board("4q3/7k/8/8/4N3/8/8/4R1K1"),
      marks: ["e1", "e8"],
      text: "A discovered attack happens when one piece moves away and uncovers an attack from the piece behind it. Your rook is aimed at the queen, but your own knight is in the way. If the knight leaves with a threat of its own, your opponent has two problems and only one move.",
    },
    {
      kind: "move",
      fen: board("4q3/7k/8/8/4N3/8/8/4R1K1"),
      goal: { type: "play", from: "e4", to: "g5", or: [{ from: "e4", to: "f6" }] },
      text: "Move the knight so that it gives check. The rook behind it will then be attacking the queen.",
      success: "The king has to deal with the check, and then your rook takes the queen. The piece that moves away can go almost anywhere, because the real threat comes from behind it.",
    },
  ],
};

// ------------------------------------------------------------- Checkmates

const BACK_RANK_MATE: Lesson = {
  id: "back-rank-mate",
  group: "checkmates",
  title: "The back-rank mate",
  summary: "A king trapped behind his own pawns.",
  piece: "rook",
  steps: [
    {
      kind: "info",
      fen: board("6k1/5ppp/8/8/8/8/8/4R1K1"),
      marks: ["f7", "g7", "h7"],
      text: "The back rank is the row where the king starts. A castled king often sits behind three pawns. They protect him, but they also block his escape. A rook or queen that reaches the back rank can then give checkmate.",
    },
    {
      kind: "move",
      fen: board("6k1/5ppp/8/8/8/8/8/4R1K1"),
      goal: { type: "checkmate" },
      text: "Give checkmate on the back rank.",
      success: "Checkmate. The king's own pawns left him no way out.",
    },
    {
      kind: "move",
      fen: board("3r2k1/5ppp/8/8/8/8/8/3QR1K1"),
      goal: { type: "checkmate" },
      text: "Black's rook guards the back rank, but it is the only guard. Find the checkmate.",
      success: "Checkmate. Once the only defender is captured, nothing can take your queen and the king still cannot escape.",
    },
    {
      kind: "info",
      fen: board("6k1/5ppp/8/8/8/7P/5PP1/6K1"),
      marks: ["h2"],
      text: "To protect your own king, give him an escape square before trouble starts. One small pawn move is enough, like the h-pawn here: the king can now step to h2. Players call this making luft, the German word for air.",
    },
  ],
};

const QUEEN_MATE: Lesson = {
  id: "queen-mate",
  group: "checkmates",
  title: "Mate with king and queen",
  summary: "Finishing the most common winning endgame.",
  piece: "queen",
  steps: [
    {
      kind: "info",
      fen: board("6k1/8/6K1/8/8/8/8/3Q4"),
      text: "A queen cannot give checkmate alone. She needs her king. The plan has three parts: use the queen to push the enemy king to the edge of the board, walk your own king up close, then give checkmate.",
    },
    {
      kind: "move",
      fen: board("6k1/8/6K1/8/8/8/8/3Q4"),
      goal: { type: "checkmate" },
      text: "The black king is on the edge, and your king covers the squares in front of him. Give checkmate.",
      success: "Checkmate. The queen attacks along the edge and your king guards every escape square.",
    },
    {
      kind: "move",
      fen: board("k7/8/1K6/8/8/8/8/7Q"),
      goal: { type: "checkmate" },
      text: "Same idea in the corner. Give checkmate.",
      success: "Checkmate. Corners and edges are where a king runs out of squares.",
    },
    {
      kind: "info",
      fen: board("7k/5Q2/6K1/8/8/8/8/8", "b"),
      marks: ["g8", "g7", "h7"],
      text: "Be careful. Here it is Black's turn. His king is not in check, but every square he could move to is attacked. That is stalemate, and the game is a draw. Unless you are giving check, always leave the enemy king a square to move to.",
    },
    {
      kind: "move",
      fen: board("7k/8/5QK1/8/8/8/8/8"),
      goal: { type: "checkmate" },
      text: "Finish this one properly. Give checkmate, not stalemate.",
      success: "Checkmate. A check that leaves no escape wins the game; a quiet move that leaves no escape only draws.",
    },
  ],
};

const ROOK_MATE: Lesson = {
  id: "rook-mate",
  group: "checkmates",
  title: "The ladder mate",
  summary: "Two rooks walk the king to the edge.",
  piece: "rook",
  steps: [
    {
      kind: "info",
      fen: board("7k/R7/8/8/8/8/8/1R4K1"),
      marks: ["a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7"],
      text: "Two rooks give checkmate like climbing a ladder. One rook guards a row so the king cannot cross it. The other checks on the next row, pushing the king back. Here one rook already guards the highlighted row.",
    },
    {
      kind: "move",
      fen: board("7k/R7/8/8/8/8/8/1R4K1"),
      goal: { type: "checkmate" },
      text: "The king is on the last row and cannot come forward. Give checkmate with the other rook.",
      success: "Checkmate. One rook holds the row in front of the king, the other attacks him along the edge.",
    },
    {
      kind: "move",
      fen: board("k7/7R/8/8/8/8/8/K5R1"),
      goal: { type: "checkmate" },
      text: "The same pattern from the other side. Give checkmate.",
      success: "Checkmate. Keep your rooks far from the enemy king, so he cannot walk up and attack them.",
    },
  ],
};

// --------------------------------------------------------------- Openings

const ITALIAN_GAME_LINE: Line = {
  learner: "white",
  moves: [
    {
      san: "e4",
      ask: "Start by taking space in the centre. Move the pawn in front of your king two squares, to e4.",
      why: "A pawn in the centre controls important squares, and your queen and bishop now have a way out.",
    },
    { san: "e5", note: "Black takes a share of the centre too." },
    {
      san: "Nf3",
      ask: "Bring out the knight on your king's side to f3, where it attacks the pawn on e5.",
      why: "You developed a piece and made a threat with the same move. Doing two things at once saves time.",
    },
    { san: "Nc6", note: "The knight defends the pawn." },
    {
      san: "Bc4",
      ask: "Now develop your bishop to c4.",
      why: "The bishop aims at f7, the weakest square in Black's camp, because only the king guards it. This set-up is called the Italian Game.",
    },
    { san: "Bc5", note: "Black develops the same way." },
    {
      san: "O-O",
      ask: "Your knight and bishop have moved out, so nothing stands between your king and rook. Castle: move your king two squares to the right.",
      why: "The king is safe behind three pawns and the rook is ready to come to the centre.",
    },
    { san: "Nf6", note: "The knight attacks your pawn on e4." },
    {
      san: "d3",
      ask: "Defend the pawn by moving your d-pawn one square, to d3.",
      why: "The e4 pawn is protected, and your other bishop now has a way out too.",
    },
  ],
};

const ITALIAN_GAME: Lesson = {
  id: "italian-game",
  group: "openings",
  title: "The Italian Game",
  summary: "A simple, sound way to start as White.",
  piece: "bishop",
  steps: lineWithOutro(
    ITALIAN_GAME_LINE,
    "This is a healthy opening position. The recipe works in almost every game: put a pawn in the centre, bring out your knights and bishops, then castle. Try not to move the same piece twice, and do not bring your queen out early.",
  ),
};

const RUY_LOPEZ_BLACK_LINE: Line = {
  learner: "black",
  moves: [
    { san: "e4", note: "This is the most common first move." },
    {
      san: "e5",
      ask: "You are playing Black. Answer in the centre: move your king's pawn two squares, to e5.",
      why: "You have claimed your half of the centre and opened lines for your queen and bishop.",
    },
    { san: "Nf3", note: "It attacks your pawn on e5." },
    {
      san: "Nc6",
      ask: "Defend the pawn by developing your knight to c6.",
      why: "A defence that also develops a piece is the best kind.",
    },
    { san: "Bb5", note: "The bishop attacks the knight that defends your pawn. This opening is called the Ruy Lopez." },
    {
      san: "a6",
      ask: "Ask the bishop what it wants: push your a-pawn one square to attack it.",
      why: "The bishop has to decide. If it takes your knight, you take back, and White cannot safely win the e5 pawn.",
    },
    { san: "Ba4", note: "The bishop steps back but keeps watching your knight." },
    {
      san: "Nf6",
      ask: "Keep developing. Bring your other knight to f6, where it attacks the pawn on e4.",
      why: "Both of your knights are out, and White now has a pawn to look after as well.",
    },
    { san: "O-O", note: "White's king is safe." },
    {
      san: "Be7",
      ask: "Develop your bishop to e7, so that you can castle too.",
      why: "The bishop shields your king along the e-file, and the squares between your king and rook are now empty.",
    },
    { san: "Re1", note: "The rook defends the e4 pawn, so White's bishop is now free to take your knight." },
    {
      san: "b5",
      ask: "Chase the bishop away from your knight: push your b-pawn to b5.",
      why: "The bishop can no longer capture the knight that defends your e5 pawn.",
    },
    { san: "Bb3", note: "The bishop moves to a new diagonal, aiming at f7." },
    {
      san: "O-O",
      ask: "Castle. Move your king two squares towards the rook on your king's side.",
      why: "Your king is safe and you have a solid position.",
    },
  ],
};

const RUY_LOPEZ_BLACK: Lesson = {
  id: "ruy-lopez-black",
  group: "openings",
  title: "Playing Black against e4",
  summary: "Stay solid when White moves first.",
  piece: "pawn",
  orientation: "black",
  steps: lineWithOutro(
    RUY_LOPEZ_BLACK_LINE,
    "You have reached one of the oldest positions in chess. As Black you move second, so your first aim is to match White in the centre, develop every piece and castle. You did all three.",
  ),
};

// ------------------------------------------------------ Gambits and traps

const QUEENS_GAMBIT_LINE: Line = {
  learner: "white",
  moves: [
    {
      san: "d4",
      ask: "This opening starts with the queen's pawn. Move it two squares, to d4.",
      why: "This pawn is protected by your queen from the very first move.",
    },
    { san: "d5", note: "Black blocks your pawn." },
    {
      san: "c4",
      ask: "Now offer a pawn. Move your c-pawn two squares, to c4, where Black's pawn can capture it.",
      why: "This is the Queen's Gambit. A gambit gives up a pawn to gain something else. Here you want to pull Black's pawn away from the centre.",
    },
    { san: "dxc4", note: "Black accepts the gambit and is a pawn ahead." },
    {
      san: "e3",
      ask: "Open a path for your bishop: move your e-pawn one square, to e3.",
      why: "Your bishop now attacks the pawn on c4, so you are ready to win it back.",
    },
    { san: "b5", note: "Black tries to keep the extra pawn by defending it. This is a well-known mistake." },
    {
      san: "a4",
      ask: "Attack the defender. Push your a-pawn two squares, to a4.",
      why: "The b5 pawn is holding Black's position together, and now it is under attack.",
    },
    { san: "c6", note: "Black defends the defender." },
    {
      san: "axb5",
      ask: "Capture the pawn on b5 with your a-pawn.",
      why: "When Black takes back, the long diagonal towards the rook in the corner will be wide open.",
    },
    { san: "cxb5", note: "Black's pawns are still in a chain, but look at the diagonal." },
    {
      san: "Qf3",
      ask: "Punish the greed. Bring your queen to f3, aiming down the long diagonal.",
      why: "The queen attacks the rook in the corner, and Black cannot save it without losing a knight or bishop instead.",
    },
  ],
};

const QUEENS_GAMBIT: Lesson = {
  id: "queens-gambit",
  group: "gambits",
  title: "The Queen's Gambit",
  summary: "A pawn that is only lent, never given.",
  piece: "queen",
  steps: lineWithOutro(
    QUEENS_GAMBIT_LINE,
    "Black is losing a piece. The lesson works both ways. As White, the Queen's Gambit pawn is not really a sacrifice, because you can win it back. As Black, take the pawn if you like, but do not cling to it.",
  ),
};

const KINGS_GAMBIT_LINE: Line = {
  learner: "white",
  moves: [
    {
      san: "e4",
      ask: "Start with the king's pawn: move it to e4.",
      why: "The usual first step into the centre.",
    },
    { san: "e5", note: "Black meets you in the centre." },
    {
      san: "f4",
      ask: "Offer a pawn. Move your f-pawn two squares, to f4, where Black can take it.",
      why: "This is the King's Gambit. If Black captures, his pawn leaves the centre and the f-file opens for your rook.",
    },
    { san: "exf4", note: "Black accepts. Your king is a little exposed now, and Black's queen could give check on h4." },
    {
      san: "Nf3",
      ask: "Stop that check before it happens. Develop your knight to f3.",
      why: "The knight guards h4, so the queen cannot come there, and it is a useful developing move as well.",
    },
    { san: "g5", note: "Black defends the extra pawn." },
    {
      san: "Bc4",
      ask: "Develop your bishop to c4, aiming at f7.",
      why: "You are a pawn down, but your pieces are coming out faster than Black's.",
    },
    { san: "Bg7", note: "Black develops a bishop." },
    {
      san: "O-O",
      ask: "Castle on the king's side.",
      why: "Your rook now stands on the half-open f-file, pointing towards Black's king.",
    },
  ],
};

const KINGS_GAMBIT: Lesson = {
  id: "kings-gambit",
  group: "gambits",
  title: "The King's Gambit",
  summary: "Give up a pawn for a fast attack.",
  piece: "king",
  steps: lineWithOutro(
    KINGS_GAMBIT_LINE,
    "You are a pawn behind, but every one of your pieces is working and your king is safe. That is the bargain in a true gambit: material in exchange for time and open lines. It is exciting and risky, so make sure you know what you are getting for the pawn.",
  ),
};

const SCHOLARS_MATE_LINE: Line = {
  learner: "black",
  moves: [
    { san: "e4", note: "A normal start." },
    {
      san: "e5",
      ask: "You are playing Black. Reply with your king's pawn to e5.",
      why: "So far, so normal.",
    },
    { san: "Qh5", note: "The queen comes out very early and attacks your pawn on e5." },
    {
      san: "Nc6",
      ask: "Defend the pawn by developing your knight to c6.",
      why: "The pawn is safe and you have developed a piece.",
    },
    {
      san: "Bc4",
      note: "Now the queen and the bishop both aim at f7. White is threatening checkmate there on the next move. This trap is called Scholar's Mate.",
    },
    {
      san: "g6",
      ask: "Block the queen's path to f7: push your g-pawn one square, to g6.",
      why: "The checkmate is stopped, and your pawn attacks the queen, so she must move again.",
    },
    { san: "Qf3", note: "The queen steps back and threatens checkmate on f7 a second time." },
    {
      san: "Nf6",
      ask: "Block again, with a piece this time. Develop your knight to f6.",
      why: "The threat is over for good, and you have developed another piece.",
    },
  ],
};

const SCHOLARS_MATE: Lesson = {
  id: "scholars-mate",
  group: "gambits",
  title: "Surviving Scholar's Mate",
  summary: "The four-move checkmate, and how to stop it.",
  piece: "queen",
  orientation: "black",
  steps: lineWithOutro(
    SCHOLARS_MATE_LINE,
    "The trap has failed. White's queen has moved three times, while you brought out two knights. Bringing the queen out early only works against someone who does not see the threat. Before every move, ask what your opponent is aiming at.",
  ),
};

const LEGALS_TRAP_LINE: Line = {
  learner: "white",
  moves: [
    { san: "e4", ask: "Open with your king's pawn to e4.", why: "The centre again." },
    { san: "e5", note: "Black replies in kind." },
    { san: "Nf3", ask: "Develop your knight to f3.", why: "It attacks the e5 pawn." },
    { san: "d6", note: "Black defends the pawn with another pawn." },
    { san: "Bc4", ask: "Develop your bishop to c4.", why: "It aims at f7, as usual." },
    { san: "Bg4", note: "The bishop pins your knight: if the knight moves, the bishop can take your queen." },
    { san: "Nc3", ask: "Carry on developing. Bring your other knight to c3.", why: "Both of your knights and a bishop are out." },
    { san: "g6", note: "This is a slow move, and it lets you spring a famous trap." },
    {
      san: "Nxe5",
      ask: "Capture the pawn on e5 with your knight, even though that leaves your queen to be taken.",
      why: "This is a queen sacrifice. If Black takes the knight with his pawn, you take the bishop on g4 and have simply won a pawn. But if Black grabs the queen...",
    },
    { san: "Bxd1", note: "Black takes the queen. It looks like a disaster for you, but you have something better." },
    {
      san: "Bxf7+",
      ask: "Capture the pawn on f7 with your bishop. It is check.",
      why: "The king has only one square to go to.",
    },
    { san: "Ke7", note: "The king steps forward, because it is the only legal move." },
    {
      san: "Nd5#",
      ask: "Finish the game. Bring your other knight to d5.",
      why: "Checkmate! Two knights and a bishop have trapped the king in the middle of the board.",
    },
  ],
};

const LEGALS_TRAP: Lesson = {
  id: "legals-trap",
  group: "gambits",
  title: "Legal's Trap",
  summary: "A queen sacrifice that ends in checkmate.",
  piece: "knight",
  steps: lineWithOutro(
    LEGALS_TRAP_LINE,
    "You gave up your queen and won the game three moves later. That is what makes it a sacrifice and not a blunder: you got more back than you gave. Notice also that the pin on your knight was not absolute. A piece pinned to the queen is still allowed to move.",
  ),
};

export const STRATEGY_LESSONS: Lesson[] = [
  FORK,
  PIN,
  SKEWER,
  DISCOVERED_ATTACK,
  BACK_RANK_MATE,
  QUEEN_MATE,
  ROOK_MATE,
  ITALIAN_GAME,
  RUY_LOPEZ_BLACK,
  QUEENS_GAMBIT,
  KINGS_GAMBIT,
  SCHOLARS_MATE,
  LEGALS_TRAP,
];
