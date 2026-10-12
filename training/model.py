"""The neural network: a small convolutional network for 8x8 boards.

A convolution slides a small 3x3 window over the board and learns local
patterns, such as "a knight two squares from a king and a rook". Stacking
several of them lets the network combine small patterns into larger ones.
This is the same family of network used by chess programs like AlphaZero,
only far smaller.

Shape of the network:
  26 input planes
    -> 3x3 convolution to 64 channels
    -> 6 residual blocks (two 3x3 convolutions each, with a shortcut)
    -> average over the whole board
    -> one output number per label
"""

import torch
from torch import nn

from encode import NUM_PLANES
from labels import LABELS

CHANNELS = 64
BLOCKS = 6


class ResidualBlock(nn.Module):
    """Two convolutions plus a shortcut that adds the input back on.

    The shortcut lets information skip the block, which makes deeper
    networks much easier to train.
    """

    def __init__(self, channels: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.norm1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.norm2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = torch.relu(self.norm1(self.conv1(x)))
        out = self.norm2(self.conv2(out))
        return torch.relu(out + x)


class MoveClassifier(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(NUM_PLANES, CHANNELS, 3, padding=1, bias=False),
            nn.BatchNorm2d(CHANNELS),
            nn.ReLU(),
        )
        self.blocks = nn.Sequential(*[ResidualBlock(CHANNELS) for _ in range(BLOCKS)])
        self.head = nn.Linear(CHANNELS, len(LABELS))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Returns one raw score ("logit") per label. Higher means more likely."""
        features = self.blocks(self.stem(x))
        # Average each channel over the 64 squares, leaving one number per channel.
        pooled = features.mean(dim=(2, 3))
        return self.head(pooled)
