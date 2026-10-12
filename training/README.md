# Training the move classifier

This folder trains the neural network that recognises the idea behind a chess
move: a sacrifice, a fork, a pin, and so on. The website uses it to comment on
moves and to group suggested moves by category.

It is separate from the website. The website is TypeScript; this is Python and
only needs to be run when the model is retrained.

## What the model does

- **Input:** a chess position and one move.
- **Output:** a probability for each label in `labels.py`. A move can have
  several labels at once, or none.
- **Type:** a small convolutional neural network (see `model.py`).

## Where the data comes from

The [Lichess puzzle database](https://database.lichess.org/#puzzles), released
into the public domain (CC0). It holds several million positions where a
winning move exists, each tagged with themes such as `fork` or `sacrifice`.

## Setup (once)

From this folder:

```
python -m venv .venv
.venv\Scripts\activate
pip install torch --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
```

Then download `lichess_db_puzzle.csv.zst` (about 300 MB) from the link above
into `data/`.

## The three steps

Run them in order, from this folder.

| Step | Command | What it does |
|---|---|---|
| 1 | `python prepare.py` | Reads the puzzles and writes training examples to `data/`. |
| 2 | `python train.py` | Trains the model and prints its accuracy for every label. |
| 3 | `python export.py` | Converts the model for the website and writes it to `public/model/`. |

## Files

| File | Purpose |
|---|---|
| `labels.py` | The list of labels, and which Lichess themes map to each. |
| `encode.py` | Turns a position and a move into the 26 grids the model reads. |
| `prepare.py` | Builds the training, validation and test examples. |
| `model.py` | The network itself. |
| `train.py` | The training loop and the accuracy measurements. |
| `export.py` | Exports to ONNX and checks the export matches the original. |

`data/`, `runs/` and `.venv/` are not stored in Git. They are large and can be
recreated by following the steps above.

## Known limits

- Puzzles only contain winning moves, so the model cannot learn what a blunder
  looks like. The website detects blunders with the chess engine instead.
- A puzzle's themes describe its whole solution. Only short puzzles are used,
  so the theme very likely describes the first move, but some labels are still
  attached to the wrong move. This puts a ceiling on accuracy.
- Puzzle positions are always tactical. Ordinary game positions look different,
  and the model may see tactics that are not there. The "ordinary" examples in
  `prepare.py` reduce this but do not remove it.
