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
- ESLint enforces the import rules (`eslint.config.js`).

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
3. 2D board: click/drag, highlights, promotion, move list, flip
4. Engine: Stockfish worker, three starting levels
5. Hints and attacked/hanging-piece warnings

Milestone 2 (Progress Report 2, week 9)
6. Tutorial
7. Mistake detection and post-game feedback
8. Adaptive difficulty
9. 3D board (Three.js)
10. Deploy and full playthrough

Then: WebXR VR mode (Progress Report 3, week 12).

## Working style

- Build one step at a time. After each step, say what to run to test it.
- Tests sit next to the code: `foo.ts` and `foo.test.ts`.
- Keep code readable with light comments. The student has to explain it in a
  report.
- No heavy UI framework. No backend.
