import { LESSONS, LessonSession, MoveSelector } from "../../core/index";
import type { Lesson, TutorialProgress } from "../../core/index";
import { Board2D } from "../board/board2d/board2d";
import { PIECE_GLYPHS } from "../board/pieceGlyphs";
import { createPromotionDialog } from "../panels/promotionDialog";

export interface TutorialActions {
  /** The learner wants to leave the tutorial and play a game. */
  onPlay(): void;
}

/** Builds the tutorial: a list of lessons, and the lesson view with its practice board. */
export function createTutorialScreen(
  container: HTMLElement,
  progress: TutorialProgress,
  actions: TutorialActions,
): void {
  /** Tidies up the lesson that is open, if any, before showing something else. */
  let closeLesson: () => void = () => undefined;

  function showList(): void {
    closeLesson();
    closeLesson = () => undefined;

    const screen = document.createElement("main");
    screen.className = "lesson-list";

    const heading = document.createElement("h2");
    heading.textContent = "Learn chess step by step";
    const intro = document.createElement("p");
    intro.className = "lesson-list-intro";
    intro.textContent = `Start with the board, then meet each piece. ${progress.completedCount()} of ${LESSONS.length} lessons complete.`;

    const grid = document.createElement("div");
    grid.className = "lesson-grid";
    LESSONS.forEach((lesson, index) => {
      const done = progress.isComplete(lesson.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "lesson-card";
      card.classList.toggle("lesson-done", done);

      const icon = document.createElement("span");
      icon.className = "lesson-icon";
      // The board lesson has no piece, so it shows a small picture of squares.
      if (lesson.piece) {
        icon.classList.add("piece", "white");
        icon.textContent = PIECE_GLYPHS[lesson.piece];
      } else {
        icon.classList.add("lesson-icon-board");
      }

      const title = document.createElement("strong");
      title.textContent = `${index + 1}. ${lesson.title}`;
      const summary = document.createElement("span");
      summary.className = "lesson-summary";
      summary.textContent = lesson.summary;
      const state = document.createElement("span");
      state.className = "lesson-state";
      state.textContent = done ? "✓ Complete" : "Start";

      card.append(icon, title, summary, state);
      card.addEventListener("click", () => openLesson(lesson));
      grid.append(card);
    });

    screen.append(heading, intro, grid);
    if (progress.allComplete()) {
      const finished = document.createElement("div");
      finished.className = "lesson-finished";
      const text = document.createElement("p");
      text.textContent = "You have finished every lesson. Time to try a real game!";
      finished.append(text, button("Play a game", "primary", actions.onPlay));
      screen.append(finished);
    }
    container.replaceChildren(screen);
  }

  function openLesson(lesson: Lesson): void {
    closeLesson();
    const session = new LessonSession(lesson);
    // The practice board follows the same interface as a real game, so the
    // usual click-to-move logic and board view work on it unchanged.
    const selector = new MoveSelector(session.board);

    // The instructions sit in a speech bubble directly above the board, in
    // the same column, so the learner never has to look away to the side.
    const screen = document.createElement("main");
    screen.className = "lesson-screen";
    const column = document.createElement("div");
    column.className = "lesson-column";
    const panel = document.createElement("section");
    panel.className = "lesson-bubble";
    const boardArea = document.createElement("div");
    boardArea.className = "board-area";
    column.append(panel, boardArea);
    screen.append(column);
    container.replaceChildren(screen);

    const board = new Board2D(boardArea, {
      onPick: (square) => {
        // In a "pick" step a click is an answer; otherwise it selects or moves a piece.
        if (session.getView().step.kind === "pick") session.pickSquare(square);
        else selector.pick(square);
      },
      onDrop: (from, to) => selector.drop(from, to),
    });
    const promotion = createPromotionDialog({
      onChoose: (piece) => selector.choosePromotion(piece),
      onCancel: () => selector.cancelPromotion(),
    });
    boardArea.append(promotion.element);

    function draw(): void {
      const view = session.getView();
      const selection = selector.getState();

      board.render({
        position: session.board.getPosition(),
        orientation: "white",
        selected: selection.selected,
        targets: selection.targets,
        arrows: [],
        marks: view.marks.map((square) => ({ square, kind: "control" })),
        warningSquares: [],
      });
      promotion.update(selection.pendingPromotion ? "white" : null);

      if (view.complete) {
        progress.markComplete(lesson.id);
        panel.replaceChildren(...completionCard(lesson));
        return;
      }

      panel.classList.remove("lesson-complete");

      // Top row: where we are, and the way out.
      const top = document.createElement("div");
      top.className = "lesson-top";
      const lessonTitle = document.createElement("p");
      lessonTitle.className = "lesson-kicker";
      lessonTitle.textContent = `${lesson.title} · Step ${view.stepNumber} of ${view.stepCount}`;
      top.append(lessonTitle, button("All lessons", "link-button", showList));

      const progressBar = document.createElement("div");
      progressBar.className = "lesson-progress";
      const fill = document.createElement("div");
      fill.style.width = `${((view.stepNumber - 1) / view.stepCount) * 100}%`;
      progressBar.append(fill);

      const text = document.createElement("p");
      text.className = "lesson-text";
      text.textContent = view.step.text;

      const parts: HTMLElement[] = [top, progressBar, text];

      if (view.feedback) {
        const feedback = document.createElement("p");
        feedback.className = `lesson-feedback feedback-${view.feedback.kind}`;
        feedback.setAttribute("role", "status");
        feedback.textContent = view.feedback.text;
        parts.push(feedback);
      }

      // Bottom row: Back on the left, Next on the right.
      const buttons = document.createElement("div");
      buttons.className = "lesson-buttons";
      const back = button("Back", "", () => session.back());
      back.disabled = !view.canGoBack;
      buttons.append(back);

      const middle = document.createElement("span");
      middle.className = "lesson-moves";
      if (view.movesLeft !== null && view.step.kind === "move") {
        middle.textContent = view.movesLeft === 1 ? "1 move left" : `${view.movesLeft} moves left`;
      }
      buttons.append(middle);

      // Only worth offering when the learner has used a move and has more to make.
      if (view.step.kind === "move" && !view.solved && session.board.movesPlayed > 0) {
        buttons.append(button("Start again", "", () => session.restartStep()));
      }
      const isLast = view.stepNumber === view.stepCount;
      const next = button(isLast ? "Finish lesson" : "Next", "primary", () => session.next());
      next.disabled = !view.canGoNext;
      buttons.append(next);
      parts.push(buttons);

      panel.replaceChildren(...parts);
    }

    function completionCard(finished: Lesson): HTMLElement[] {
      panel.classList.add("lesson-complete");
      const card = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = "Lesson complete!";
      const text = document.createElement("p");
      text.className = "lesson-text";
      text.textContent = `You have finished “${finished.title}”. ${progress.completedCount()} of ${LESSONS.length} lessons done.`;
      card.append(title, text);

      const buttons = document.createElement("div");
      buttons.className = "lesson-buttons";
      const nextLesson = LESSONS[LESSONS.indexOf(finished) + 1];
      buttons.append(button("All lessons", "", showList));
      const spacer = document.createElement("span");
      spacer.className = "lesson-moves";
      buttons.append(spacer);
      if (nextLesson) {
        buttons.append(button(`Next lesson: ${nextLesson.title}`, "primary", () => openLesson(nextLesson)));
      } else {
        buttons.append(button("Play a game", "primary", actions.onPlay));
      }
      return [card, buttons];
    }

    const stopSession = session.onChange(draw);
    const stopSelector = selector.onChange(draw);
    closeLesson = () => {
      stopSession();
      stopSelector();
      board.destroy();
    };
    draw();
  }

  showList();
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  if (className) el.className = className;
  el.addEventListener("click", onClick);
  return el;
}
