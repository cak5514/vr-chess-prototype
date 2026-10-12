"""The ideas the model learns to recognise, and how Lichess puzzle themes map to them.

Each label is one output of the model. A move can carry several labels at
once (for example a sacrifice that is also a fork), so this is a
"multi-label" problem: every label gets its own yes/no answer.
"""

# The order here is the order of the model's outputs. Do not reorder it
# after training a model, or the outputs will be read as the wrong labels.
LABELS = [
    "ordinary",  # a normal legal move that is NOT the winning tactic
    "sacrifice",
    "fork",
    "pin",
    "skewer",
    "discoveredAttack",
    "doubleCheck",
    "attraction",
    "deflection",
    "trappedPiece",
    "hangingPiece",
    "capturingDefender",
    "defensiveMove",
    "quietMove",
    "mate",
]

# Lichess theme name -> our label. Themes not listed here are ignored
# (for example "short", "middlegame" or "crushing", which describe the
# puzzle rather than the idea behind the move).
THEME_TO_LABEL = {
    "sacrifice": "sacrifice",
    "fork": "fork",
    "pin": "pin",
    "skewer": "skewer",
    "discoveredAttack": "discoveredAttack",
    "doubleCheck": "doubleCheck",
    "attraction": "attraction",
    "deflection": "deflection",
    "trappedPiece": "trappedPiece",
    "hangingPiece": "hangingPiece",
    "capturingDefender": "capturingDefender",
    "defensiveMove": "defensiveMove",
    "quietMove": "quietMove",
    # Every kind of checkmate puzzle counts as one "mate" label.
    "mate": "mate",
    "mateIn1": "mate",
    "mateIn2": "mate",
    "backRankMate": "mate",
    "smotheredMate": "mate",
    "anastasiaMate": "mate",
    "arabianMate": "mate",
    "bodenMate": "mate",
    "doubleBishopMate": "mate",
    "dovetailMate": "mate",
    "hookMate": "mate",
    "killBoxMate": "mate",
    "vukovicMate": "mate",
}

LABEL_INDEX = {name: i for i, name in enumerate(LABELS)}


def labels_from_themes(themes: str) -> list[int]:
    """Turns a puzzle's theme text ("fork short middlegame") into label numbers."""
    found = {THEME_TO_LABEL[t] for t in themes.split() if t in THEME_TO_LABEL}
    return sorted(LABEL_INDEX[name] for name in found)
