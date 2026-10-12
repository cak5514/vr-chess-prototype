"""Step 2: train the model and measure how good it is.

Run:  python train.py

Reads   data/examples_*.npy          (made by prepare.py)
Writes  runs/model.pt                the trained network
        runs/metrics.json            accuracy for every label

How training works, in short: the model is shown a batch of positions and
guesses their labels. A "loss" number says how wrong the guesses were, and
the model's weights are nudged to make that number smaller. Repeating this
over all examples once is called an epoch.

Three separate groups of examples are used:
  - training:   the model learns from these
  - validation: used during training to pick thresholds and the best epoch
  - test:       never looked at until the very end, for an honest final score
"""

import json
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from labels import LABELS
from model import MoveClassifier

HERE = Path(__file__).parent
DATA = HERE / "data"
RUNS = HERE / "runs"

EPOCHS = 12
BATCH_SIZE = 1024
LEARNING_RATE = 2e-3

torch.manual_seed(0)


def load_split(x: np.ndarray, y: np.ndarray, split: np.ndarray, which: int, device: torch.device):
    """Returns one group of examples. They stay in ordinary memory, not on the
    graphics card, so the dataset can be bigger than the card's memory."""
    mask = split == which
    return torch.from_numpy(x[mask]), torch.from_numpy(y[mask]).to(device)


@torch.no_grad()
def predict(model: nn.Module, x: torch.Tensor) -> torch.Tensor:
    """Runs the model over many positions and returns a probability per label."""
    model.eval()
    device = next(model.parameters()).device
    parts = []
    for start in range(0, len(x), 4096):
        logits = model(x[start : start + 4096].to(device).float())
        parts.append(torch.sigmoid(logits))
    return torch.cat(parts)


def score(probabilities: torch.Tensor, truth: torch.Tensor, thresholds: torch.Tensor) -> dict:
    """Precision, recall and F1 for each label.

    precision: of the moves the model CALLED a fork, how many really were?
    recall:    of the moves that really WERE forks, how many did it find?
    F1:        one number that combines the two (1.0 is perfect).
    """
    guess = probabilities >= thresholds
    truth = truth.bool()
    result = {}
    for i, name in enumerate(LABELS):
        true_pos = (guess[:, i] & truth[:, i]).sum().item()
        false_pos = (guess[:, i] & ~truth[:, i]).sum().item()
        false_neg = (~guess[:, i] & truth[:, i]).sum().item()
        precision = true_pos / max(1, true_pos + false_pos)
        recall = true_pos / max(1, true_pos + false_neg)
        f1 = 2 * precision * recall / max(1e-9, precision + recall)
        result[name] = {
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1": round(f1, 3),
            "examples": int(truth[:, i].sum().item()),
        }
    return result


def best_thresholds(probabilities: torch.Tensor, truth: torch.Tensor) -> torch.Tensor:
    """For each label, finds the cut-off that gives the best F1 on validation data.

    The model outputs a probability. We still have to decide how sure it must
    be before we say "yes, this is a fork". Rare labels need a different
    cut-off from common ones, so each label gets its own.
    """
    candidates = torch.arange(0.05, 0.96, 0.05, device=probabilities.device)
    thresholds = torch.full((len(LABELS),), 0.5, device=probabilities.device)
    truth = truth.bool()
    for i in range(len(LABELS)):
        best_f1 = -1.0
        for cut in candidates:
            guess = probabilities[:, i] >= cut
            true_pos = (guess & truth[:, i]).sum().item()
            precision = true_pos / max(1, guess.sum().item())
            recall = true_pos / max(1, truth[:, i].sum().item())
            f1 = 2 * precision * recall / max(1e-9, precision + recall)
            if f1 > best_f1:
                best_f1, thresholds[i] = f1, cut
    return thresholds


def mean_f1(metrics: dict) -> float:
    return sum(m["f1"] for m in metrics.values()) / len(metrics)


def main() -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}")

    x = np.load(DATA / "examples_x.npy")
    y = np.load(DATA / "examples_y.npy")
    split = np.load(DATA / "examples_split.npy")
    train_x, train_y = load_split(x, y, split, 0, device)
    val_x, val_y = load_split(x, y, split, 1, device)
    test_x, test_y = load_split(x, y, split, 2, device)
    print(f"Examples: {len(train_x):,} training, {len(val_x):,} validation, {len(test_x):,} test")

    model = MoveClassifier().to(device)
    print(f"Model size: {sum(p.numel() for p in model.parameters()):,} weights")

    # Rare labels get a bigger say in the loss, otherwise the model could
    # score well by never predicting them. The weight is capped so a very
    # rare label cannot dominate.
    frequency = train_y.float().mean(dim=0).clamp(min=1e-4)
    pos_weight = ((1 - frequency) / frequency).clamp(max=20.0)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    steps_per_epoch = (len(train_x) + BATCH_SIZE - 1) // BATCH_SIZE
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=LEARNING_RATE, total_steps=EPOCHS * steps_per_epoch
    )

    RUNS.mkdir(exist_ok=True)
    best_score = -1.0
    history = []
    for epoch in range(1, EPOCHS + 1):
        started = time.time()
        model.train()
        order = torch.randperm(len(train_x))
        total_loss = 0.0
        for step in range(steps_per_epoch):
            batch = order[step * BATCH_SIZE : (step + 1) * BATCH_SIZE]
            boards = train_x[batch].to(device).float()
            loss = loss_fn(model(boards), train_y[batch.to(device)].float())
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            scheduler.step()
            total_loss += loss.item()

        val_prob = predict(model, val_x)
        thresholds = best_thresholds(val_prob, val_y)
        val_score = mean_f1(score(val_prob, val_y, thresholds))
        history.append({"epoch": epoch, "loss": round(total_loss / steps_per_epoch, 4), "val_f1": round(val_score, 4)})
        print(
            f"epoch {epoch:2d}  loss {total_loss / steps_per_epoch:.4f}  "
            f"validation F1 {val_score:.3f}  ({time.time() - started:.0f}s)",
            flush=True,
        )

        # Keep the weights from the epoch that did best on validation data.
        if val_score > best_score:
            best_score = val_score
            torch.save({"model": model.state_dict(), "thresholds": thresholds.cpu()}, RUNS / "model.pt")

    # The honest final score: the best model, on examples it has never seen.
    saved = torch.load(RUNS / "model.pt", map_location=device)
    model.load_state_dict(saved["model"])
    thresholds = saved["thresholds"].to(device)
    test_metrics = score(predict(model, test_x), test_y, thresholds)

    report = {
        "labels": LABELS,
        "thresholds": {name: round(thresholds[i].item(), 2) for i, name in enumerate(LABELS)},
        "test_mean_f1": round(mean_f1(test_metrics), 3),
        "test": test_metrics,
        "history": history,
        "weights": sum(p.numel() for p in model.parameters()),
        "examples": {"train": len(train_x), "validation": len(val_x), "test": len(test_x)},
    }
    (RUNS / "metrics.json").write_text(json.dumps(report, indent=2))

    print("\nTest results (examples the model never saw):")
    print(f"{'label':20s} {'precision':>9s} {'recall':>7s} {'F1':>6s} {'examples':>9s}")
    for name, m in test_metrics.items():
        print(f"{name:20s} {m['precision']:9.3f} {m['recall']:7.3f} {m['f1']:6.3f} {m['examples']:9,d}")
    print(f"\nAverage F1: {report['test_mean_f1']}")


if __name__ == "__main__":
    main()
