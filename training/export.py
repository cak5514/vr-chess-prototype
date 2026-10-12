"""Step 3: package the trained model for the website.

Run:  python export.py

Reads   runs/model.pt, runs/metrics.json     (made by train.py)
Writes  ../public/model/move_classifier.onnx   the model, in a format browsers can run
        ../public/model/move_classifier.json   label names, thresholds and test scores
        ../src/core/model/parityCases.json     a few worked examples for the website's tests

ONNX is a standard file format for neural networks. PyTorch trains the model;
the website runs the exported ONNX file with a small library, no Python needed.

The "parity cases" guard against a subtle bug. The website has its own copy
of the encoder (written in TypeScript). If it ever differs from encode.py,
the model would be fed scrambled boards and give confident nonsense. The
cases record what Python produced so the website's tests can check it
produces exactly the same.
"""

import json
from pathlib import Path

import chess
import numpy as np
import onnxruntime
import torch

from encode import NUM_PLANES, encode
from labels import LABELS
from model import MoveClassifier

HERE = Path(__file__).parent
RUNS = HERE / "runs"
PUBLIC = HERE.parent / "public" / "model"
PARITY = HERE.parent / "src" / "core" / "model" / "parityCases.json"

# Positions for the parity cases: (FEN, move in UCI notation).
# They cover both colours, a capture, castling, en passant and a promotion.
PARITY_POSITIONS = [
    ("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "g1f3"),
    ("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "g8f6"),
    ("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", "h5f7"),
    ("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", "e1g1"),
    ("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1", "e8c8"),
    ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6"),
    ("8/P6k/8/8/8/8/8/K7 w - - 0 1", "a7a8q"),
    ("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5c7"),
]


def main() -> None:
    saved = torch.load(RUNS / "model.pt", map_location="cpu")
    model = MoveClassifier()
    model.load_state_dict(saved["model"])
    model.eval()

    PUBLIC.mkdir(parents=True, exist_ok=True)
    onnx_path = PUBLIC / "move_classifier.onnx"
    example = torch.zeros(1, NUM_PLANES, 8, 8)
    torch.onnx.export(
        model,
        (example,),
        str(onnx_path),
        input_names=["board"],
        output_names=["logits"],
        # The first dimension is the batch size: the website sends several
        # candidate moves at once, so it must be allowed to vary.
        dynamic_axes={"board": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )

    # Check the exported file gives the same answers as the original model.
    session = onnxruntime.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    cases = []
    worst_difference = 0.0
    for fen, uci in PARITY_POSITIONS:
        board = chess.Board(fen)
        planes = encode(board, chess.Move.from_uci(uci))
        batch = planes[None].astype(np.float32)
        with torch.no_grad():
            expected = model(torch.from_numpy(batch)).numpy()[0]
        actual = session.run(["logits"], {"board": batch})[0][0]
        worst_difference = max(worst_difference, float(np.abs(expected - actual).max()))
        cases.append(
            {
                "fen": fen,
                "move": uci,
                # The 1664 values as a string of 0s and 1s, plane by plane, row by row.
                "planes": "".join(str(v) for v in planes.flatten()),
                "logits": [round(float(v), 4) for v in actual],
            }
        )
    assert worst_difference < 1e-3, f"ONNX and PyTorch disagree by {worst_difference}"

    metrics = json.loads((RUNS / "metrics.json").read_text())
    info = {
        "labels": LABELS,
        "thresholds": [metrics["thresholds"][name] for name in LABELS],
        "inputPlanes": NUM_PLANES,
        "testMeanF1": metrics["test_mean_f1"],
        "test": metrics["test"],
    }
    (PUBLIC / "move_classifier.json").write_text(json.dumps(info, indent=2))
    PARITY.parent.mkdir(parents=True, exist_ok=True)
    PARITY.write_text(json.dumps(cases, indent=1))

    size_kb = onnx_path.stat().st_size / 1024
    print(f"Wrote {onnx_path.name} ({size_kb:.0f} KB), largest ONNX/PyTorch difference {worst_difference:.2e}")
    print(f"Wrote move_classifier.json and {len(cases)} parity cases")


if __name__ == "__main__":
    main()
