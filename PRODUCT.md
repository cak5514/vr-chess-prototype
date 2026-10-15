# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Complete beginners at chess: students and home learners, not club players.
They know little or nothing about the game, learn at their own pace, and have
no coach or regular opponent. (Confirmed by the student on 2026-10-13.)

A second audience sees it once: visitors and examiners at the UTeM Workshop 2
exhibition, watching a short demonstration.

## Product Purpose

VR Chess Academy teaches a beginner to play chess and then lets them practise
with guidance. Success is a beginner who can finish the lessons, play a full
game against the computer, and understand afterwards which moves were good,
which were mistakes, and why.

It is the Group 21 project for UTeM Workshop 2 (BAXU 3923), built to the
proposal approved by the supervisor.

## Positioning

It does not only say which move is best. It names the idea behind a move
(a fork, a pin, a sacrifice) with a model the group trained itself, and it
draws the line between a sacrifice and a blunder: the same act of giving up a
piece, judged by whether it works.

## Operating Context

- Runs entirely in the browser, with no account and no server.
- Intended target for now is a VR headset; it must also stay usable on a
  laptop and other screens. (Student's answer: "versatile, but target is vr
  for now".) The VR mode itself is not built yet; today the site is used with
  a mouse on a flat screen and has a 3D board.
- Learn tab: 20 lessons in five groups (basics, tactics, checkmates, openings,
  gambits and traps), each a sequence of short steps on a practice board.
- Play tab: a game against an adaptive computer opponent, with one of three
  help settings.

## Capabilities and Constraints

- Three help modes. Commenter: silent before a move, then rates it and
  explains the rating. Coach: before a move, lists sound moves grouped as
  attack, defend, prepare an attack, prepare your defence, set a trap, or
  sacrifice, without revealing the best one. No help.
- Post-game summary: result, move count, captures, mistakes with explanations,
  and recommendations.
- Adaptive difficulty on a ladder of ten levels.
- 2D board and 3D board, switchable during a game.
- Board highlight colours carry meaning in lessons and comments: blue for
  squares controlled, red for attack, orange for danger, purple for support.
  The student did not mark these as fixed.
- Everything is client-side. No backend, no heavy UI framework.
- Undecided: how the interface is presented inside a headset.

## Brand Commitments

- The name "VR Chess Academy" is fixed. It is the title on the approved
  proposal.
- Nothing else about the identity was marked as fixed.

## Evidence on Hand

- The trained move classifier: 0.86 average F1 on 234,474 held-out Lichess
  puzzle examples, with at least 1,000 test examples per label
  (`training/`, `public/model/move_classifier.json`).
- The lesson content in `src/core/tutorial/`, with tests that check each
  chess claim against the rules.
- No user testing with real beginners has been done. No testimonials, usage
  numbers or endorsements exist, and none may be invented.

## Product Principles

1. A beginner comes first. Nothing on screen may assume chess knowledge that
   a lesson has not taught.
2. Explain, do not only judge. Every rating and suggestion carries a reason
   in plain words.
3. The engine decides what is true; the model and the rules explain it.
   The product never presents a guess as a fact.
4. The board is the centre of attention. Everything else supports reading it.
5. It must hold up in a headset and on a laptop, because both are how it will
   be shown.
