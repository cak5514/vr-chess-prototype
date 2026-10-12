"""Turns a chess position plus one move into numbers the model can read.

A neural network cannot read a chessboard directly. We describe the board as
a stack of 8x8 grids called planes. Each plane answers one yes/no question
for every square, such as "is there one of my knights here?". A 1 means yes.

The 26 planes:
   0- 5  my pieces BEFORE the move      (pawn, knight, bishop, rook, queen, king)
   6-11  opponent's pieces BEFORE the move
  12     the square the move starts from
  13     the square the move lands on
  14-19  my pieces AFTER the move
  20-25  opponent's pieces AFTER the move

"My" always means the side making the move. When black is moving, the board
is flipped top to bottom, so the model always sees the mover playing "up the
board". That way it learns one set of patterns instead of two.

IMPORTANT: the website has the same encoder written in TypeScript
(src/core/model/encodeMove.ts). The two must stay identical, or the model
will be shown boards it was never trained on.
"""

import chess
import numpy as np

NUM_PLANES = 26
PIECE_ORDER = [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]


def _write_pieces(board: chess.Board, mover: chess.Color, first_plane: int, out: np.ndarray) -> None:
    for square, piece in board.piece_map().items():
        row = chess.square_rank(square)
        col = chess.square_file(square)
        if mover == chess.BLACK:
            row = 7 - row
        plane = first_plane + PIECE_ORDER.index(piece.piece_type)
        if piece.color != mover:
            plane += 6
        out[plane, row, col] = 1


def _mark(square: chess.Square, mover: chess.Color, plane: int, out: np.ndarray) -> None:
    row = chess.square_rank(square)
    if mover == chess.BLACK:
        row = 7 - row
    out[plane, row, chess.square_file(square)] = 1


def encode(board: chess.Board, move: chess.Move) -> np.ndarray:
    """Returns the 26x8x8 grid of 0s and 1s for `move` played on `board`."""
    mover = board.turn
    out = np.zeros((NUM_PLANES, 8, 8), dtype=np.uint8)

    _write_pieces(board, mover, 0, out)
    _mark(move.from_square, mover, 12, out)
    _mark(move.to_square, mover, 13, out)

    after = board.copy(stack=False)
    after.push(move)
    _write_pieces(after, mover, 14, out)
    return out
