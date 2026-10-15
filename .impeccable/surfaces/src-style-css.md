---
version: 1
slug: "src-style-css"
primary_target: "src/style.css"
related_targets: ["src/main.ts","src/ui/screens/playScreen.ts","src/ui/screens/tutorialScreen.ts"]
---

Scope: the whole site (header, lesson list, lessons, Play screen and its panels, game summary, 2D and 3D boards). Visitor mode: Operate.

Audience and job: a complete beginner learning chess and playing guided games; exhibition visitors watching a short demonstration. The board and the explanations must stay easy to read; the user named "hard to read" as the one unacceptable outcome. Target device is a VR headset browser for now, and it must stay usable on a laptop.

Chosen direction: The Listening Room. Memorable moment: every rating and level read off an engraved tick scale.

Unresolved: how the interface is presented inside the headset (the VR mode is not built).

## Direction contract

THESIS: Luxury as precision. The site is a chess set built like a fine audio instrument. It refuses the category default of a green or brown board on a dark dashboard with a row of coloured buttons.

OWN-WORLD: A pale bead-blasted aluminium field (#DADBD6) and a graphite panel (#1B1C1E) own whole regions. The board is smoked oak and pale oak with a graphite frame. One brass line (#A8844B) marks what is selected or live. One typeface, Hanken Grotesk, at a short set of size steps; rank comes from weight, case and rule. Corners are near square (2px). State is drawn as engraved ticks whose height and doubling change, not colour alone.

STORY: The visitor sees a calm, expensive-looking instrument, understands at once where the board, the coach and the commentary are, and plays or learns without having to decode the styling.

FIRST VIEWPORT: A 64px graphite bar with the name in spaced capitals at left and Learn and Play tabs at right. Below, two regions: the aluminium plinth holding the status line, the 640px oak board and the level scale; and a 468px graphite panel holding the Coach list, the commentary with its rating scale, the controls and settings. The primary action is on the board itself.

FORM: Candidate 4 of 7 on the grounded list (high-end audio equipment), assigned by seed key 7560a747. Signature interaction: the tick scale, used for move ratings, the adaptive level and lesson progress, with the lit tick sliding to its new position.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
