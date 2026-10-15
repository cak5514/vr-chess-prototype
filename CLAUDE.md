# VR Chess Academy

UTeM Workshop 2 (BAXU 3923) project, Group 21. A beginner chess trainer that
runs fully in the browser. The website is built first; a WebXR VR mode is added
on top of it afterwards.

## Commands

- `npm install` - install dependencies (first time only)
- `npm run dev` - start the dev server
- `npm test` - run the unit tests once
- `npm run test:watch` - re-run tests on every save
- `npm run lint` - check code style and the layer rules
- `npm run build` - type-check and build into `dist/`

## Architecture rules

Three layers. Each layer only talks to the one below it.

1. `src/core/` - game state, rules, engine interface, hints, analysis,
   feedback, tutorial logic. No DOM, no Three.js, no `localStorage`.
   Everything here must be unit tested in plain Node.
2. `src/ui/` - 2D and 3D boards, panels and screens. Calls into core.
3. `src/modes/` - future `vr/` and `ar/` input modes. Call into core.

`src/platform/` holds browser-only pieces (Stockfish worker, localStorage)
that implement interfaces defined in core and are passed in from `main.ts`.

- `ui/`, `modes/` and `platform/` import from `src/core/index.ts` only.
- Every input source (mouse, VR controller, camera) drives the game through
  the same core interface: `attemptMove(from, to)` plus a position-changed event.
- 2D and 3D boards implement the same `BoardView` interface.
- Boards only report "square picked" and "piece dropped". The pick-then-move
  logic lives in `core/input/moveSelector.ts` so every board and mode shares it.
- ESLint enforces the import rules (`eslint.config.js`).
- The engine is the `ChessEngine` interface in `core/engine`. `UciEngine`
  speaks the UCI protocol over a `UciTransport`; the real transport is the
  Stockfish Web Worker in `platform/`, and tests use `FakeTransport`.
- Engine files are in `public/stockfish/` (lite single-threaded build, GPL v3).
  They are copied in by hand, not installed from npm.
- `ComputerOpponent` plays its moves through the same `attemptMove()` as the
  human. Use its `undoTurn()` for undo so the computer's reply is undone too.

- Hints: the engine picks the move (`core/hints`), then fixed rules explain
  it in plain English. Every reason also returns the squares and arrows that
  show it on the board, colour-coded by `MarkKind`; when adding a rule, give
  it marks too. Warnings come from `core/analysis/threats.ts`, which
  counts attackers and defenders and does not use the engine.

- Move review (Module III): `GameReviewer` asks the engine about each player
  move in the background while the game is played. `reviewMove` compares the
  best move's score with the score after the move played, labels the loss
  (inaccuracy 60, mistake 150, blunder 300 centipawns) and explains it.
  `summariseGame` in `core/feedback` builds the post-game summary and advice.
- Adaptive difficulty (Module II): `core/difficulty/adaptive.ts` keeps a rating
  from 1 to 10 that `rateGame` moves up after wins and down after losses with
  blunders. Only games against the "Adaptive" opponent change it.
- Tutorial: lesson content is plain data in `core/tutorial/lessons.ts`.
  `LessonSession` runs a lesson on an `ExerciseBoard`, a practice board that
  implements `GameInput` (so boards and `MoveSelector` work on it), allows
  positions without kings, and lets white move repeatedly. A test proves every
  exercise is solvable, so run `npm test` after editing lessons.
- Saved progress goes through the `KeyValueStore` interface in
  `core/progress`; the localStorage version is in `platform/`.
- `main.ts` builds the Learn and Play screens once and only hides/shows them.

- Move classifier (the project's own trained model): a small convolutional
  network trained in `training/` (Python, PyTorch) on the Lichess puzzle
  database. Given a position and a move it outputs ideas such as sacrifice,
  fork, pin (`IdeaLabel`). The exported model is `public/model/`; the browser
  runs it through `platform/onnxMoveClassifier.ts` behind the `MoveClassifier`
  interface in `core/model`. `core/model/encodeMove.ts` must stay identical to
  `training/encode.py`; a parity test checks this. Retrain with the three
  commands in `training/README.md`.
- The engine stays the judge of whether a move is good (blunders are detected
  by evaluation drop). The model names the idea behind a move.

## Product direction: three modes

Agreed with the student on 2026-10-12. These replace the single hint button.

- Commenter: silent before the move. After every move it rates the move and
  justifies the rating. Built on `GameReviewer` plus the move classifier.
- Coach: before the move, lists sound candidate moves grouped by category
  (attack, defend, prepare attack, prepare defence, trap, sacrifice) without
  saying which is best; the player picks. The Commenter also rates the pick.
- Teacher: lessons on openings, gambits and traps, tactics, and basic
  checkmates. Extends the tutorial; needs scripted opponent replies.
- Plain play with no help stays available.

Status: Commenter is built. `GameReviewer` attaches the model's ideas and an
`offered` flag (a piece put at risk) to each `MoveReview`, and
`core/commenter/comment.ts` turns a review into a rating and text. A sound
move that offers material is rated "sacrifice"; the same offer on an unsound
move is a blunder.

Coach is built too (`core/coach/candidates.ts`). It asks the engine for its
top 8 moves, keeps those within `SOUND_MARGIN` (50 centipawns) of the best,
and sorts them into categories with `decideCategory`: the engine checks
whether capturing an offered piece is a mistake (trap) or playable
(sacrifice); otherwise the main hint reason's `purpose` decides, with the
model able to upgrade quiet moves. Groups are alphabetical so the best move
is not revealed. Each `HintReason` now carries a `purpose`; when adding a hint
rule, make sure the right purpose is set before `add()`.

The Play screen's Help setting is Commenter (default), Coach, or none. The
old hint button and danger warnings are gone from the screen; `findHint` and
`findThreatenedPieces` remain in core because Coach and Commenter use the
rules behind them.

Teacher is built as an extension of the tutorial (the Learn tab). Lessons
now have a `group` (basics, tactics, checkmates, openings, gambits); the
strategy lessons are in `core/tutorial/strategyLessons.ts`. Opening and gambit
lessons are written as a line of moves in chess notation, and
`lineBuilder.ts` turns a line into steps and works out every position. It
throws if a move is illegal or its notation is wrong (a missing "+" or "#"),
so a bad line fails the tests. `strategyLessons.test.ts` checks each lesson's
chess claims against the rules (the fork really attacks both pieces, the mate
really is mate). `ExerciseBoard` lets the learner play whichever side is to
move, so lessons can be played as Black (`orientation: "black"`).

All three modes now exist.

The 3D board is in `ui/board/board3d`. `ChessScene` is the chess set alone
(board, pieces, highlights, picking by ray) with no camera or canvas, so the
VR mode can put the same scene in a headset. `Board3D` adds the canvas,
camera, orbit controls and mouse clicks and implements `BoardView`. Pieces
are built in code in `pieceModels.ts`; there are no model files. The Play
screen loads the 3D code only when the player presses "3D board", and falls
back to 2D if the device cannot draw it. The tutorial stays 2D.

Look and feel ("The Listening Room", 2026-10-13): the design system is
written down in `DESIGN.md`, and the product summary in `PRODUCT.md`. Read
`DESIGN.md` before changing anything visual. In short: an aluminium plinth
holds the board, a graphite side panel holds the text, the board is pale and
smoked oak, and brass is the only accent. All colours and sizes are tokens at
the top of `src/style.css`; the font is Hanken Grotesk (bundled from npm).
- Positions on a range (opponent level, move rating, lesson progress) are
  shown with the engraved tick scale, `ui/panels/tickScale.ts`.
- The side panel has a scrolling part and a pinned foot (`.panel-foot`) that
  always shows the verdict on the last move and the game buttons.
- Pieces are drawn in code. `ui/board/pieceOutlines.ts` holds the shapes;
  the 2D board draws them as SVG (`pieceIcon.ts`) and the 3D board spins the
  same outlines into solids, so the two sets always match.
- Wood and metal grain are generated (SVG noise in CSS, a canvas texture in
  3D). There are no image files.

Deployment: `vite.config.ts` uses a relative `base`, so the built site works
from any sub-folder. `.github/workflows/deploy.yml` tests, lints, builds and
publishes to GitHub Pages on every push to `main` (the repository's Pages
source must be set to "GitHub Actions" once). The built site is about 18 MB,
mostly the ONNX runtime.

Next in the original plan: publish, then VR.

## What the proposal requires

The submitted proposal wins over any other instruction.

- Module I, Interactive Chess Tutorial: the board, six pieces, basic moves,
  legal-move examples. Lives in `core/tutorial`.
- Module II, VR Chess Practice: play against an AI opponent whose difficulty
  adapts to the player's performance. Lives in `core/engine`, `core/difficulty`.
- Module III, Basic Performance Feedback: post-game result, move count,
  captures, identified mistakes, recommendations. Lives in `core/analysis`,
  `core/feedback`.
- AR is not in the proposal. Optional extra only.

## Build order

Milestone 1 (Progress Report 1, week 5)
1. Scaffold - done
2. Core game: rules, `attemptMove`, position events, undo, new game - done
3. 2D board: click/drag, highlights, promotion, move list, flip - done
4. Engine: Stockfish worker, three starting levels - done
5. Hints and attacked/hanging-piece warnings - done

Milestone 2 (Progress Report 2, week 9)
6. Tutorial - done
7. Mistake detection and post-game feedback - done
8. Adaptive difficulty - done
9. 3D board (Three.js) - done
10. Deploy and full playthrough - prepared and tested locally; publishing
    waits for the student to create the GitHub repository

Then: WebXR VR mode (Progress Report 3, week 12).

## Working style

- Build one step at a time. After each step, say what to run to test it.
- Tests sit next to the code: `foo.ts` and `foo.test.ts`.
- Keep code readable with light comments. The student has to explain it in a
  report.
- No heavy UI framework. No backend.
