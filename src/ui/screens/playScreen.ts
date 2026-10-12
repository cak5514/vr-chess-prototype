import {
  AdaptiveDifficulty,
  commentOn,
  ComputerOpponent,
  findCandidates,
  Game,
  GameReviewer,
  getLevel,
  groupByCategory,
  MoveSelector,
  summariseGame,
} from "../../core/index";
import type {
  Candidate,
  ChessEngine,
  Color,
  KeyValueStore,
  MoveClassifier,
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

function other(color: Color): Color {
  return color === "white" ? "black" : "white";
}

/** The coach's suggestions, and the position they were worked out for. */
interface CoachAdvice {
  fen: string;
  candidates: Candidate[];
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

  // The kind of help the player chose.
  let helpMode: HelpMode = "commenter";
  // Coach mode: the suggestions for the current position, the position we
  // are waiting on, and the suggestion the player is looking at.
  let advice: CoachAdvice | null = null;
  let adviceRequestedFor: string | null = null;
  let previewed: Candidate | null = null;

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
  const coach = createCoachPanel({
    onPreview: (candidate) => {
      previewed = candidate;
      draw();
    },
    // Picking a suggestion plays it through the same door as a mouse move.
    onChoose: (candidate) => {
      previewed = null;
      game.attemptMove(candidate.move.from, candidate.move.to, candidate.move.promotion);
    },
  });
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
        previewed = null;
        refreshCoach();
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
    coach.element,
    commentary.element,
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
    refreshCoach();
    draw();
  }

  /** True when a human is the one who has to move now. */
  function isHumanTurn(): boolean {
    const position = game.getPosition();
    if (position.status !== "playing") return false;
    return opponentChoice === "friend" || position.turn === playerColor;
  }

  /** In Coach mode, asks for suggestions whenever it becomes the player's turn. */
  function refreshCoach(): void {
    if (helpMode !== "coach" || !isHumanTurn() || engineError) return;
    const { fen, lastMove } = game.getPosition();
    if (advice?.fen === fen || adviceRequestedFor === fen) return;

    adviceRequestedFor = fen;
    findCandidates(engine, classifier, fen, lastMove)
      .then((candidates) => {
        // Only keep the answer if the board is still the one we asked about.
        if (game.getPosition().fen === fen) advice = { fen, candidates };
      })
      .catch((error) => {
        console.error("Chess engine problem:", error);
        engineError = true;
      })
      .finally(() => {
        if (adviceRequestedFor === fen) adviceRequestedFor = null;
        draw();
      });
  }

  // One function redraws everything from the current game and selection.
  function draw(): void {
    const position = game.getPosition();
    const selection = selector.getState();
    const againstComputer = opponentChoice !== "friend";
    const humanTurn = isHumanTurn();
    const reviews = reviewer.getReviews();

    const coaching = helpMode === "coach";
    const currentAdvice = coaching && advice?.fen === position.fen ? advice : null;
    // The suggestion being looked at is drawn on the board: an arrow for the
    // move, plus the squares and arrows that explain it.
    const shown = currentAdvice && previewed ? previewed : null;
    const arrows: BoardArrow[] = shown
      ? [{ from: shown.move.from, to: shown.move.to, kind: "move" }, ...shown.arrows]
      : [];

    board.render({
      position,
      orientation,
      selected: selection.selected,
      targets: selection.targets,
      arrows,
      marks: shown ? shown.squares : [],
      warningSquares: [],
    });
    status.update(position, {
      playerColor: againstComputer ? playerColor : null,
      engineError: againstComputer && engineError,
    });
    coach.update({
      visible: coaching,
      playersTurn: humanTurn,
      loading: currentAdvice === null,
      groups: currentAdvice ? groupByCategory(currentAdvice.candidates) : [],
    });
    // The Commenter needs a single player to comment on, so it is off with
    // two humans. It also runs in Coach mode, rating the move that was picked.
    commentary.update(
      helpMode !== "none" && againstComputer,
      reviews.map(commentOn),
      reviewer.pendingCount() > 0,
    );
    controls.update(position.history.length > 0);
    moveList.update(position.history, helpMode === "none" ? [] : reviews);
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
    // Suggestions belong to one position and are dropped when it changes.
    previewed = null;
    // A fresh game can be rated again.
    if (position.history.length === 0) {
      gameRated = false;
      levelChange = null;
    }
    refreshCoach();
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
