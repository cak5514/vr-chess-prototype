---
name: VR Chess Academy
description: A beginner chess trainer styled as a fine audio instrument - aluminium, graphite, oak and one brass line.
colors:
  brass: "#c79f5a"
  brass-deep: "#73541f"
  alu: "#dadbd6"
  alu-hi: "#e6e7e2"
  alu-lo: "#cbccc6"
  alu-line: "#a9aba5"
  ink: "#1b1c1e"
  ink-soft: "#47494c"
  graphite: "#1b1c1e"
  graphite-raised: "#26282b"
  graphite-line: "#3d3f42"
  pale: "#edeee9"
  pale-soft: "#babcb6"
  control-line: "#8d8f8a"
  control-line-on-graphite: "#56585b"
  tick: "#6f716c"
  tick-on-graphite: "#7b7d80"
  oak-pale: "#d9c4a1"
  oak-smoke: "#5a4334"
  piece-white: "#f4f0e6"
  piece-black: "#202124"
  piece-black-outline: "#e9e3d3"
  good: "#9ccfa4"
  fair: "#e2c46b"
  poor: "#e8a062"
  bad: "#ef8275"
  good-deep: "#245c33"
  bad-deep: "#9b2c20"
  mark-control: "#2f7fd1"
  mark-attack: "#d1362f"
  mark-danger: "#e08a1a"
  mark-support: "#8a52c7"
typography:
  display:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 300
    lineHeight: 1.15
  title:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 300
    lineHeight: 1.15
  lead:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.14em"
rounded:
  control: "2px"
  board: "3px"
spacing:
  tab-gap: "4px"
  control-gap: "8px"
  gutter-narrow: "16px"
  section: "24px"
  gutter-panel: "36px"
  gutter-page: "40px"
components:
  button:
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 1.1rem"
    height: "44px"
  button-hover:
    backgroundColor: "{colors.alu-hi}"
    textColor: "{colors.ink}"
  button-on-graphite:
    textColor: "{colors.pale}"
    rounded: "{rounded.control}"
    padding: "0 1.1rem"
    height: "44px"
  button-on-graphite-hover:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.pale}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.pale}"
    rounded: "{rounded.control}"
    padding: "0 1.1rem"
    height: "44px"
  button-primary-on-graphite:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 1.1rem"
    height: "44px"
  nav-tab:
    textColor: "{colors.pale-soft}"
    rounded: "{rounded.control}"
    padding: "0 1.4rem"
    height: "44px"
  nav-tab-active:
    backgroundColor: "{colors.alu}"
    textColor: "{colors.ink}"
  select:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.pale}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 2.4rem 0 0.9rem"
    height: "44px"
  coach-move:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.pale}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  coach-move-lit:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.ink}"
  idea-label:
    textColor: "{colors.brass}"
    rounded: "{rounded.control}"
    padding: "0.1rem 0.55rem"
  lesson-row:
    textColor: "{colors.ink}"
    padding: "14px 8px"
  lesson-row-hover:
    backgroundColor: "{colors.alu-hi}"
  lesson-plate:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.pale}"
    rounded: "{rounded.control}"
    padding: "20px 24px"
  promotion-box:
    backgroundColor: "{colors.alu-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "28px"
---

# Design System: VR Chess Academy

## Overview

**Creative North Star: "The Listening Room"**

The site looks like a chess set built by a maker of high-end audio equipment. There are two grounds. A pale, bead-blasted aluminium field holds the board. A graphite panel holds the words. The board is pale oak and smoked oak in a graphite frame. One brass colour marks what is selected or live. The idea is luxury as precision: few materials, exact edges, nothing decorative.

The audience is a complete beginner, so the look never gets in the way of reading. The board is the largest thing on the screen. Text is large and high in contrast. Anything that sits on a range (the opponent's level, the rating of a move, progress through a lesson) is shown on an engraved scale of ticks with one lit marker, the way a level meter shows volume.

No image files ship. The metal grain and the 2D wood grain are SVG noise filters written inside the stylesheet. The 3D wood grain is painted on a canvas in code. The pieces are drawn from one set of outline data, as flat silhouettes in 2D and as solid models in 3D.

**Key Characteristics:**
- Two grounds only: aluminium (light) and graphite (dark).
- One accent: brass.
- One typeface: Hanken Grotesk, six sizes.
- Near-square corners (2px, 3px on the board).
- Sections are divided by thin rules, not placed in boxes.
- The tick scale is the signature shape.
- All texture and all pieces are generated in code.

## Colors

A quiet metal and wood palette. Colour is saved for meaning: brass for "selected or live", four rating colours, and four hint colours on the board.

### Primary
- **Brass** (`brass`): the single accent, used on graphite and on the board. It fills the last-move squares (42% opacity), frames the selected square, colours the move arrow, the lesson progress marker, the "sacrifice" rating, the idea labels, the focus ring on graphite and the text selection.
- **Deep Brass** (`brass-deep`): the same accent on the light ground, where plain brass would be too faint. It is the focus ring on aluminium and the idea-label colour on a lit Coach row.

### Neutral
- **Bead-blasted Aluminium** (`alu`, `alu-hi`, `alu-lo`): the light ground. The plinth shades from `alu-hi` at the top to `alu-lo` at the bottom under a fine noise grain. `alu-hi` is also the hover fill and the promotion box.
- **Aluminium Line** (`alu-line`): 1px rules between lesson rows.
- **Ink** (`ink`, `ink-soft`): text on aluminium. `ink-soft` is for secondary text.
- **Graphite** (`graphite`, `graphite-raised`, `graphite-line`): the top bar, the side panel, the lesson plate and the board frame. `graphite-raised` is a row or field that can be pressed. `graphite-line` is the 1px rule between panel sections.
- **Pale** (`pale`, `pale-soft`): text on graphite. `pale-soft` is for secondary text.
- **Control Line** (`control-line`, `control-line-on-graphite`): the 1px border of buttons and selects on each ground.
- **Tick** (`tick`, `tick-on-graphite`): the unlit ticks of a scale on each ground.
- **Pale Oak and Smoked Oak** (`oak-pale`, `oak-smoke`): the light and dark squares, in 2D and 3D. Each square's coordinate is printed in the other oak.
- **Pieces** (`piece-white`, `piece-black`, `piece-black-outline`): white pieces are ivory with a graphite outline. Black pieces are near-black with a pale outline, so both read on both woods.

### Secondary: move ratings
- **Good** (`good`): "best" and "good" moves, and a win.
- **Fair** (`fair`): an inaccuracy.
- **Poor** (`poor`): a mistake, and the "try again" border in a lesson.
- **Bad** (`bad`): a blunder, and a loss.
- **Deep Good and Deep Bad** (`good-deep`, `bad-deep`): the same meanings on aluminium ("Done" on a lesson row; check and errors in the status line).

### Tertiary: hint marks on the board
- **Control Blue** (`mark-control`): squares a piece controls.
- **Attack Red** (`mark-attack`): an attack, a capture ring, the king in check.
- **Danger Orange** (`mark-danger`): a piece in danger.
- **Support Purple** (`mark-support`): a piece that defends another.

### Named Rules
**The One Brass Rule.** Brass is the only accent. It means "this is selected, or this just happened". Do not use it for decoration or for body text.

**The Two Grounds Rule.** Every surface is aluminium or graphite. Buttons do not hard-code colours. They read `--control-fg`, `--control-line`, `--control-hover`, `--primary-bg`, `--primary-fg` and `--focus`, and those six values flip when the surface is graphite.

**The Same Meaning Rule.** A hint colour means the same thing in lessons, in comments, on the 2D board and on the 3D board. Rating colours are tuned for graphite; on aluminium use the deep versions.

## Typography

**Display Font:** Hanken Grotesk Variable (with Hanken Grotesk, system-ui, sans-serif)
**Body Font:** the same family

**Character:** One clean grotesque for everything. It is self-hosted through the `@fontsource-variable/hanken-grotesk` package, so no font is fetched from another site. Big statements are light. Labels are small, bold, spaced capitals, like lettering engraved on a faceplate.

### Hierarchy
- **Display** (300, 2.125rem / 34px, 1.15): the status line above the board ("Your turn") and the lesson list heading. Drops to Title size below 960px.
- **Title** (300, 1.75rem / 28px, 1.15 to 1.2): the newest move rating, the game result, "Lesson complete!".
- **Lead** (500, 1.3125rem / 21px, 1.25): panel section headings, the lesson title, the verdict rating. Lesson group headings use 600.
- **Body** (400, 1.0625rem / 17px, 1.5): running text. Row titles use it at 600. Explanations are capped at 34em to 44em wide.
- **Small** (400, 0.9375rem / 15px, 1.5): button text (500), secondary lines, the move list, statistics.
- **Label** (600, 0.8125rem / 13px, 0.14em, uppercase): field labels, Coach category names, summary headings, the level line, lesson state. The words at the ends of a scale use 0.1em. The product name in the bar uses the Small size at 0.22em.

### Named Rules
**The One Face Rule.** There is one typeface. Rank comes from weight, case and a rule line, not from a second font.

**The Light Is Large Rule.** Weight 300 is only used at Title and Display size. Anything smaller is 400 or heavier.

**The Tabular Rule.** Move numbers, statistics and scale ends use tabular figures so columns line up.

## Layout

A 64px graphite bar sits on top: the product name at the left, the Learn and Play tabs at the right.

The Play screen is two regions side by side. The aluminium plinth takes the free width. The graphite panel is fixed at 468px. The screen is exactly as tall as the window under the bar. Only the panel scrolls; the board stays still.

On the plinth, the status line, the board and the level scale share one width. That width is the smallest of: the plinth, the window height less the bar and 200px, and 640px. So the board always fits on screen.

The panel has a part that scrolls (summary, Coach, commentary, settings, move list) and a foot that stays in view (the verdict on the last move, then the game buttons). Panel sections have 24px of padding above and below and a 36px side gutter.

The lesson list is a centred column up to 68rem wide with a 40px gutter. Lessons are rows in a ruled list, two columns when there is room (each at least 26rem). Inside a lesson there is one centred column: the graphite instruction plate, then the board, both the same width, up to 640px.

Below 960px the Play screen stacks. The board takes the full width. The panel foot moves to the top of the panel, straight under the board. Gutters shrink to 16px, the lesson list becomes one column, and the page scrolls as a whole.

Every button and select is at least 44px tall. Sizes inside the 2D board are a share of the board's width (`cqw` units), so marks scale with the board. Square names never go below 11px.

## Elevation & Depth

The system is flat. Depth comes from the two grounds and from material, not from stacked cards. Three things lift, each with one soft shadow pulled tight underneath it, like an object standing on the metal.

### Shadow Vocabulary
- **Board on plinth** (`box-shadow: 0 26px 46px -22px rgba(27, 28, 30, 0.55)`): the 2D board.
- **Promotion box** (`box-shadow: 0 26px 46px -22px rgba(27, 28, 30, 0.7)`): the box over the dimmed board (`rgba(27, 28, 30, 0.62)` scrim).
- **Lesson plate** (`box-shadow: 0 18px 30px -18px rgba(27, 28, 30, 0.6)`): the instruction plate above the lesson board.

The 3D board casts real soft shadows from one directional light. Its canvas is transparent, so the set stands directly on the plinth.

### Named Rules
**The Standing Object Rule.** A shadow means "this object stands on the plinth". Rows, buttons and panel sections never have one.

**The Generated Grain Rule.** Texture is made in code and ships as no image file. Metal is a 160px SVG noise tile. 2D wood is a stretched SVG noise layer over the squares at 50% opacity, multiplied. 3D wood is 48 broad wavy streaks painted on a 256px canvas with a fixed seed, so it always looks the same.

## Shapes

Corners are nearly square. Controls, rows, labels and plates use 2px. The board, the 3D canvas and the promotion scrim use 3px. The only round shapes are on the board: a dot for a legal move and a ring for a capture.

Borders are 1px. Rules between sections are 1px. The board frame is a 10px graphite band. Ticks and the marker are 3px wide bars with square ends.

Pieces are simple turned shapes. Each piece is one outline (a radius at each height), mirrored for the 2D silhouette and spun for the 3D model. Toppers (a ball, a bar) and the knight's head are added on top. 2D silhouettes have a 2.2 unit outline with round joins.

## Components

### Buttons
- **Shape:** near-square (2px), 1px border, at least 44px tall, transparent fill, Small text at weight 500.
- **Primary:** filled with `--primary-bg`: ink on aluminium, pale on graphite. Weight 600. Used once per view (Next, Play again).
- **Hover / Focus:** the fill changes to `--control-hover` and the border to the text colour over 140ms. A primary button keeps its fill and its border turns brass. Focus is a 2px outline, 2px away, in `--focus` (brass on graphite, deep brass on aluminium). Disabled is 40% opacity.
- **Link button:** underlined text with no border ("All lessons", "Cancel"). The underline thickens to 2px on hover.

### Navigation
- **Tabs:** two buttons in the bar with a 4px gap. At rest they have no border and `pale-soft` text. The active tab is an aluminium key with ink text at weight 600, so it matches the ground of the page below it.

### Inputs / Fields
- **Select:** `graphite-raised` fill, 1px border, 2px corners, 44px tall, full width, with a small drawn chevron in place of the browser arrow. Used only on graphite.
- **Field label:** a Label above the select.

### Panel sections
- **Style:** no box. Each visible section after the first gets a 1px `graphite-line` rule above it. Heading in Lead.

### Coach move row
- **Style:** a full-width key on `graphite-raised`, 14px by 16px padding, 2px corners, no visible border. The move in bold Body, the reason in `pale-soft` Small.
- **State:** on hover, on focus, or when its piece is picked up on the board, the row turns pale with ink text, like a lit key.
- **Groups:** each category has a Label heading with a count at the right and a rule under it.

### Idea labels
- **Style:** a small outlined tag naming the idea behind a move (fork, pin, sacrifice). 1px border in the text colour, 2px corners, bold spaced capitals (0.08em). Brass on graphite, deep brass on a lit row.

### Commentary
- **Newest comment:** the move in `pale-soft` Small, the rating in Title size in its rating colour, idea labels, then the reasons.
- **Earlier comments:** ruled rows with the move, the rating in bold Small, and the first reason in `pale-soft`.

### Lesson row
- **Style:** a row with a rule above it. A 48px smoked-oak tile holds the piece silhouette. Then the title in bold Body, a summary in Small, and the state as a Label at the right ("Done" in `good-deep`).
- **Hover:** the row fills with `alu-hi`.

### Lesson plate
- **Style:** a graphite plate above the board, the same width as the board, with a small diamond pointer aimed down at it. It holds the title, the progress scale, the instruction, feedback and the buttons. It is at least 10.5rem tall so the board does not jump between steps.
- **Feedback:** a 1px outlined note. The border is `good` when right and `poor` for "try again".

### Board
- **Frame and squares:** 10px graphite frame, 3px corners, oak squares under the grain layer. Square names sit in the corners in the opposite oak.
- **Last move:** brass tint at 42%. **Selected:** an inset brass frame. **Check:** an inset red frame.
- **Legal moves:** a dot on an empty square (graphite on pale oak, pale on smoked oak), a red ring around a piece that can be taken.
- **Hint marks:** an inset frame and a 26% tint in the mark's colour. The wood stays visible.
- **Arrows:** filled arrows with a thin pale outline. Brass for the move; the mark colours for explanations.
- **3D board:** the same colours and marks as flat tiles, dots, rings and arrows lying on the board.

### The engraved scale (signature)
A row of 3px ticks with one lit marker. The marker is 30px tall, taller than any tick, and doubled (two bars), so it reads without colour. It slides to its new place in 420ms with the ease `cubic-bezier(0.16, 1, 0.3, 1)`. A screen reader hears the whole scale as one picture with a sentence such as "Level 3 of 10". With reduced motion the marker jumps.

- **Level scale:** ten ticks, 14px apart, on the plinth under the board. Every fifth tick is taller (20px against 14px), as on a ruler. Ink marker. "1" and "10" at the ends.
- **Rating scale:** five ticks, 16px apart, at the foot of the panel. They rise from worst to best (8, 12, 16, 20, 24px). The marker takes the rating colour. "Blunder" and "Best" at the ends. A sound sacrifice shares the top tick with the best move and is brass.
- **Progress scale:** one tick per lesson step, 16px apart, on the lesson plate. Brass marker.

## Do's and Don'ts

### Do:
- **Do** put new surfaces on aluminium or graphite, and let buttons take their colours from the six `--control-*`, `--primary-*` and `--focus` tokens.
- **Do** use the tick scale whenever a value sits on a range. Always give it a spoken description.
- **Do** show a rating as a word plus its place on the scale. Colour comes third.
- **Do** separate panel sections with a 1px rule.
- **Do** keep every control at least 44px tall and square names at least 11px.
- **Do** use the deep version of brass, good and bad on aluminium.
- **Do** make texture in code (SVG noise or canvas) and draw pieces from the shared outline data.
- **Do** turn CSS transitions off under `prefers-reduced-motion`.

### Don't:
- **Don't** add a second accent colour or a second typeface.
- **Don't** use brass for decoration. It marks what is selected or live.
- **Don't** give a hint colour a new meaning. Blue is control, red is attack, orange is danger, purple is support.
- **Don't** use weight 300 below Title size.
- **Don't** add image files for wood, metal or pieces.
- **Don't** put a shadow on a row, a button or a panel section.
- **Don't** round corners beyond 3px, except the move dot and capture ring.
