import {
  AdaptiveDifficulty,
  commentOn,
  ComputerOpponent,
  describeThreat,
  findHint,
  findThreatenedPieces,
  Game,
  GameReviewer,
  getLevel,
  MoveSelector,
  summariseGame,
} from "../../core/index";
import type {
  ChessEngine,
  Color,
  Hint,
  KeyValueStore,
  MoveClassifier,
  MoveReview,
  RatingChange,
} from "../../core/index";
import { Board2D } from "../board/board2d/board2d";
import type { BoardArrow, BoardView } from "../board/boardView";
import { createCoachPanel } from "../panels/coachPanel";
import { createCommentaryPanel } from "../panels/commentaryPanel";
import { createControls } from "../panels/controls";
import { createGameSetup } from "../panels/gameSetup";
import { createGameSummary } from "../panels/gameSummary";
import type { HelpMode, OpponentChoice } from "../panels/gameSetup";
import { createMoveList } from "../panels/moveList";
import { createPromotionDialog } from "../panels/promotionDialog";
import { createStatusBar } from "../panels/statusBar";

/** Showing every piece in danger at once is overwhelming, so list only the worst. */
const MAX_WARNINGS = 2;

function other(color: Color): Color {
  return color === "white" ? "black" : "white";
}

/** Builds the screen where a game is played: board on the left, panel on the right. */
export function createPlayScreen(
  container: HTMLElement,
  engine: ChessEngine,
  store: KeyValueStore,
  classifier: MoveClassifier,
): void {
  const game = new Game();
  const selector = new MoveSelector(game);
  const adaptive = new AdaptiveDifficulty(store);
  const opponent = new ComputerOpponent(game, engine, adaptive.getLevel());
  // Created after the opponent on purpose: both react to each move, and the
  // opponent's request should reach the engine first so its reply is not delayed.
  const reviewer = new GameReviewer(game, engine, { classifier });

  // The choices the player makes in the setup panel.
  let opponentChoice: OpponentChoice = "adaptive";
  let playerColor: Color = "white";
  let orientation: Color = "white";
  let engineError = false;

  // How the adaptive level changed after the game that just ended. It is set
  // once per game, when the game is over and every move has been reviewed.
  let levelChange: RatingChange | null = null;
  let gameRated = false;

  // The kind of help the player chose. Commenter speaks only after a move;
  // Hints helps before it. `coachEnabled` is shorthand for "Hints mode is on".
  let helpMode: HelpMode = "commenter";
  let coachEnabled = false;
  // A hint belongs to one position and is dropped when the position changes.
  let hint: Hint | null = null;
  let hintLoading = false;

  const screen = document.createElement("main");
  screen.className = "play-screen";

  const boardArea = document.createElement("div");
  boardArea.className = "board-area";
  const sidePanel = document.createElement("aside");
  sidePanel.className = "side-panel";
  screen.append(boardArea, sidePanel);
  container.replaceChildren(screen);

  const board: BoardView = new Board2D(boardArea, {
    onPick: (square) => selector.pick(square),
    onDrop: (from, to) => selector.drop(from, to),
  });

  const promotion = createPromotionDialog({
    onChoose: (piece) => selector.choosePromotion(piece),
    onCancel: () => selector.cancelPromotion(),
  });
  boardArea.append(promotion.element);

  const status = createStatusBar();
  const coach = createCoachPanel({ onHintRequested: () => void showHint() });
  const commentary = createCommentaryPanel();
  const setup = createGameSetup(
    {
      onOpponentChanged: (choice) => {
        opponentChoice = choice;
        applySetup();
      },
      onPlayerColorChanged: (color) => {
        playerColor = color;
        orientation = color;
        applySetup();
      },
      onHelpModeChanged: (mode) => {
        helpMode = mode;
        coachEnabled = mode === "hints";
        hint = null;
        draw();
      },
    },
    opponentChoice,
    helpMode,
  );
  const controls = createControls({
    onNewGame: () => game.newGame(),
    onUndo: () => opponent.undoTurn(),
    onFlip: () => {
      orientation = other(orientation);
      draw();
    },
  });
  const moveList = createMoveList();
  const summary = createGameSummary({ onPlayAgain: () => game.newGame() });
  sidePanel.append(
    status.element,
    summary.element,
    commentary.element,
    coach.element,
    controls.element,
    setup.element,
    moveList.element,
  );

  /** Tells the opponent and the board who controls which pieces. */
  function applySetup(): void {
    if (opponentChoice === "friend") {
      selector.setMovableColors(["white", "black"]);
      opponent.setComputerColor(null);
      // Feedback is for games against the computer.
      reviewer.setPlayerColor(null);
    } else {
      selector.setMovableColors([playerColor]);
      reviewer.setPlayerColor(playerColor);
      opponent.setLevel(opponentChoice === "adaptive" ? adaptive.getLevel() : getLevel(opponentChoice));
      opponent.setComputerColor(other(playerColor));
    }
    draw();
  }

  /** True when a human is the one who has to move now. */
  function isHumanTurn(): boolean {
    const position = game.getPosition();
    if (position.status !== "playing") return false;
    return opponentChoice === "friend" || position.turn === playerColor;
  }

  async function showHint(): Promise<void> {
    if (!isHumanTurn() || hintLoading) return;
    const { fen, lastMove } = game.getPosition();
    hintLoading = true;
    draw();
    try {
      const found = await findHint(engine, fen, lastMove);
      // Only show it if the board is still the one we asked about.
      if (game.getPosition().fen === fen) hint = found;
    } catch (error) {
      console.error("Chess engine problem:", error);
      engineError = true;
    }
    hintLoading = false;
    draw();
  }

  /**
   * A comment on the player's most recent move, if it was a mistake or a
   * blunder. It appears a moment after the move, once the engine has checked it.
   */
  function lastMoveNotice(reviews: MoveReview[]): string | null {
    const history = game.getPosition().history;
    // Find the player's latest move: the last one, or the one before the computer's reply.
    let ply = history.length - 1;
    while (ply >= 0 && history[ply].color !== playerColor) ply--;
    if (ply < history.length - 2) return null;

    const review = reviews.find((item) => item.ply === ply);
    if (!review || (review.quality !== "mistake" && review.quality !== "blunder")) return null;
    return `Your move ${review.san} was a ${review.quality}. ${review.explanation ?? ""} You can press Undo to try again.`;
  }

  // One function redraws everything from the current game and selection.
  function draw(): void {
    const position = game.getPosition();
    const selection = selector.getState();
    const againstComputer = opponentChoice !== "friend";
    const humanTurn = isHumanTurn();
    const reviews = reviewer.getReviews();

    // Warn the player whose turn it is about their own pieces.
    const threats =
      coachEnabled && humanTurn ? findThreatenedPieces(position.fen, position.turn) : [];
    const shownThreats = threats.slice(0, MAX_WARNINGS);

    // The hint's move, plus the squares and arrows that explain each reason.
    const shownHint = coachEnabled ? hint : null;
    const arrows: BoardArrow[] = shownHint
      ? [
          { from: shownHint.move.from, to: shownHint.move.to, kind: "move" },
          ...shownHint.reasons.flatMap((reason) => reason.arrows),
        ]
      : [];

    board.render({
      position,
      orientation,
      selected: selection.selected,
      targets: selection.targets,
      arrows,
      marks: shownHint ? shownHint.reasons.flatMap((reason) => reason.squares) : [],
      warningSquares: shownThreats.map((threat) => threat.square),
    });
    status.update(position, {
      playerColor: againstComputer ? playerColor : null,
      engineError: againstComputer && engineError,
    });
    coach.update({
      enabled: coachEnabled,
      canAskForHint: humanTurn && !engineError,
      hintLoading,
      hint,
      warnings: shownThreats.map(describeThreat),
      moveNotice: coachEnabled && position.status === "playing" ? lastMoveNotice(reviews) : null,
    });
    // Commenter mode needs a single player to comment on, so it is off with two humans.
    commentary.update(
      helpMode === "commenter" && againstComputer,
      reviews.map(commentOn),
      reviewer.pendingCount() > 0,
    );
    controls.update(position.history.length > 0);
    moveList.update(position.history, reviews);
    const gameSummary =
      againstComputer && position.status !== "playing"
        ? summariseGame(position, reviews, playerColor)
        : null;

    // Adjust the adaptive level once, after the last move has been reviewed.
    if (gameSummary && opponentChoice === "adaptive" && !gameRated && reviewer.pendingCount() === 0) {
      gameRated = true;
      levelChange = adaptive.recordGame(gameSummary);
      opponent.setLevel(adaptive.getLevel());
      setup.setAdaptiveRating(adaptive.getRating());
    }
    summary.update(gameSummary, reviewer.pendingCount(), opponentChoice === "adaptive" ? levelChange : null);
    promotion.update(selection.pendingPromotion ? position.turn : null);
  }

  game.onPositionChanged((position) => {
    hint = null;
    // A fresh game can be rated again.
    if (position.history.length === 0) {
      gameRated = false;
      levelChange = null;
    }
    draw();
  });
  selector.onChange(draw);
  reviewer.onChange(draw);
  opponent.onThinkingChanged(draw);
  opponent.onError((error) => {
    console.error("Chess engine problem:", error);
    engineError = true;
    draw();
  });
  setup.setAdaptiveRating(adaptive.getRating());
  applySetup();
}
