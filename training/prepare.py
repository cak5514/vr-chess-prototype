"""Step 1: turn the Lichess puzzle database into training examples.

Run:  python prepare.py

Reads   data/lichess_db_puzzle.csv.zst
Writes  data/examples_x.npy   the encoded positions (one 26x8x8 grid each)
        data/examples_y.npy   the labels (one row of 0s and 1s each)
        data/examples_split.npy  0 = training, 1 = validation, 2 = test
        data/prepare_stats.json  how many examples each label got

Each puzzle gives us up to two examples:
  - the winning move, labelled with the puzzle's themes (fork, sacrifice...)
  - one other legal move in the same position, labelled "ordinary"

The second kind matters. Without it the model would only ever see winning
tactics and would call every move a tactic.

The whole database is read. Encoding the boards is the slow part, so it is
shared between all the processor's cores.
"""

import csv
import io
import json
import multiprocessing
import random
import zlib
from pathlib import Path

import chess
import numpy as np
import zstandard

from encode import NUM_PLANES, encode
from labels import LABEL_INDEX, LABELS, labels_from_themes

DATA = Path(__file__).parent / "data"
SOURCE = DATA / "lichess_db_puzzle.csv.zst"

# How many "ordinary" examples to add for each winning move, on average.
ORDINARY_RATIO = 0.5
# Themes describe the whole puzzle. In a long puzzle the fork might happen
# on the third move, not the first, so we only use short puzzles where the
# theme almost certainly describes the first move.
MAX_MOVES_IN_PUZZLE = 4
# Skip puzzles that few people played or that players rated badly.
MIN_PLAYS = 100
MIN_POPULARITY = 70
# More than half of all puzzles are plain checkmates. Keeping every one
# would drown out the rarer ideas, so only this share of the puzzles whose
# ONLY label is "mate" is kept.
MATE_ONLY_KEEP = 0.35
# Every label must have at least this many test examples, so its accuracy
# figure can be trusted. prepare.py stops with an error if one falls short.
MIN_TEST_EXAMPLES = 1000

CHUNK_SIZE = 5000


def split_for(puzzle_id: str) -> int:
    """Puts each puzzle in training (80%), validation (10%) or test (10%).

    The choice depends only on the puzzle's id, so it never changes between
    runs, and both examples from one puzzle always land in the same group.
    """
    bucket = zlib.crc32(puzzle_id.encode()) % 100
    if bucket < 80:
        return 0
    return 1 if bucket < 90 else 2


def read_puzzles() -> list[tuple]:
    """Reads the database and keeps the puzzles we can learn from."""
    mate_only = [LABEL_INDEX["mate"]]
    rng = random.Random(0)
    kept = []
    rows_read = 0
    with open(SOURCE, "rb") as raw:
        text = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(raw), encoding="utf-8")
        for row in csv.DictReader(text):
            rows_read += 1
            if rows_read % 1_000_000 == 0:
                print(f"  read {rows_read:,} puzzles, kept {len(kept):,}", flush=True)
            if int(row["NbPlays"]) < MIN_PLAYS or int(row["Popularity"]) < MIN_POPULARITY:
                continue
            moves = row["Moves"].split()
            if len(moves) < 2 or len(moves) > MAX_MOVES_IN_PUZZLE:
                continue
            label_ids = labels_from_themes(row["Themes"])
            if not label_ids:
                continue
            if label_ids == mate_only and rng.random() > MATE_ONLY_KEEP:
                continue
            kept.append((row["PuzzleId"], row["FEN"], moves[0], moves[1], label_ids))
    print(f"  read {rows_read:,} puzzles in total, kept {len(kept):,}", flush=True)
    return kept


def encode_chunk(puzzles: list[tuple]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Encodes a batch of puzzles. Runs in a worker process."""
    x = np.zeros((len(puzzles) * 2, NUM_PLANES, 8, 8), dtype=np.uint8)
    y = np.zeros((len(puzzles) * 2, len(LABELS)), dtype=np.uint8)
    split = np.zeros(len(puzzles) * 2, dtype=np.uint8)
    count = 0
    for puzzle_id, fen, opponent_move, solution_uci, label_ids in puzzles:
        # The first move in the file is the opponent's. The puzzle starts after it.
        board = chess.Board(fen)
        board.push_uci(opponent_move)
        solution = chess.Move.from_uci(solution_uci)
        group = split_for(puzzle_id)

        x[count] = encode(board, solution)
        y[count, label_ids] = 1
        split[count] = group
        count += 1

        # Seeded by the puzzle id, so the same puzzle always gets the same
        # ordinary move, whichever worker handles it.
        rng = random.Random(zlib.crc32(puzzle_id.encode()))
        if rng.random() < ORDINARY_RATIO:
            others = [move for move in board.legal_moves if move != solution]
            if others:
                x[count] = encode(board, rng.choice(others))
                y[count, LABEL_INDEX["ordinary"]] = 1
                split[count] = group
                count += 1
    return x[:count], y[:count], split[:count]


def main() -> None:
    print("Reading the puzzle database...", flush=True)
    puzzles = read_puzzles()
    chunks = [puzzles[i : i + CHUNK_SIZE] for i in range(0, len(puzzles), CHUNK_SIZE)]

    workers = max(1, multiprocessing.cpu_count() - 1)
    print(f"Encoding {len(puzzles):,} puzzles on {workers} processor cores...", flush=True)
    parts = []
    with multiprocessing.Pool(workers) as pool:
        for done, part in enumerate(pool.imap(encode_chunk, chunks), start=1):
            parts.append(part)
            if done % 40 == 0:
                print(f"  {done * CHUNK_SIZE:,} puzzles encoded", flush=True)

    x = np.concatenate([part[0] for part in parts])
    y = np.concatenate([part[1] for part in parts])
    split = np.concatenate([part[2] for part in parts])
    np.save(DATA / "examples_x.npy", x)
    np.save(DATA / "examples_y.npy", y)
    np.save(DATA / "examples_split.npy", split)

    test = split == 2
    stats = {
        "puzzles_used": len(puzzles),
        "examples": int(len(x)),
        "train": int((split == 0).sum()),
        "validation": int((split == 1).sum()),
        "test": int(test.sum()),
        "per_label": {name: int(y[:, i].sum()) for i, name in enumerate(LABELS)},
        "per_label_test": {name: int(y[test, i].sum()) for i, name in enumerate(LABELS)},
    }
    (DATA / "prepare_stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))

    too_few = {name: n for name, n in stats["per_label_test"].items() if n < MIN_TEST_EXAMPLES}
    if too_few:
        raise SystemExit(f"These labels have fewer than {MIN_TEST_EXAMPLES} test examples: {too_few}")
    print(f"Every label has at least {MIN_TEST_EXAMPLES:,} test examples.")


if __name__ == "__main__":
    main()
