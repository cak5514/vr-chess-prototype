import { describe, expect, it } from "vitest";
import type { ChessEngine, EngineLine, EngineRequest, EngineResult } from "../engine/engine";
import type { IdeaLabel, MoveClassifier } from "../model/moveClassifier";
import type { MoveChoice } from "../types";
import {
  buildCandidate,
  CATEGORIES,
  decideCategory,
  findBait,
  findCandidates,
  groupByCategory,
  MAX_CANDIDATES,
  selectSound,
} from "./candidates";
import type { Candidate } from "./candidates";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** White's knight on f3 can step to e5, where the d6 pawn can take it. */
const KNIGHT_AND_PAWN = "4k3/8/3p4/8/8/5N2/8/4K3 w - - 0 1";

function line(from: string, to: string, cp: number): EngineLine {
  const move: MoveChoice = { from, to };
  return { move, pv: [move], scoreCp: cp };
}

describe("selectSound", () => {
  it("keeps moves within half a pawn of the best", () => {
    const lines = [line("e2", "e4", 40), line("d2", "d4", 30), line("g1", "f3", -10), line("a2", "a3", -11)];
    expect(selectSound(lines).map((item) => item.move.to)).toEqual(["e4", "d4", "f3"]);
  });

  it("always keeps the best move, even when it is the only good one", () => {
    const lines = [line("e2", "e4", 500), line("d2", "d4", 0)];
    expect(selectSound(lines)).toHaveLength(1);
  });

  it("never returns more than the maximum", () => {
    const many = Array.from({ length: 12 }, (_, i) => line("e2", "e4", 30 - i));
    expect(selectSound(many)).toHaveLength(MAX_CANDIDATES);
  });

  it("returns nothing when there are no moves", () => {
    expect(selectSound([])).toEqual([]);
  });
});

describe("findBait", () => {
  it("finds a piece moved to where it can be captured", () => {
    expect(findBait(KNIGHT_AND_PAWN, { from: "f3", to: "e5" })).toEqual({ piece: "knight", square: "e5" });
  });

  it("finds a pawn left undefended by the move", () => {
    // The knight on f3 guards the e5 pawn against the queen. Moving it away leaves the pawn free.
    const fen = "4k3/4q3/8/4P3/8/5N2/8/4K3 w - - 0 1";
    expect(findBait(fen, { from: "f3", to: "d2" })).toEqual({ piece: "pawn", square: "e5" });
  });

  it("does not treat a pawn trade as an offer", () => {
    // exd5 can be taken back by the queen, but white has already won a pawn for it.
    const fen = "3qk3/8/8/3p4/4P3/8/8/4K3 w - - 0 1";
    expect(findBait(fen, { from: "e4", to: "d5" })).toBeNull();
  });

  it("finds nothing after a safe move", () => {
    expect(findBait(START, { from: "g1", to: "f3" })).toBeNull();
    expect(findBait(KNIGHT_AND_PAWN, { from: "f3", to: "d4" })).toBeNull();
  });
});

describe("decideCategory", () => {
  it("follows the main reason when nothing else is known", () => {
    expect(decideCategory("attack", [], null)).toBe("attack");
    expect(decideCategory("defend", [], null)).toBe("defend");
    expect(decideCategory("prepare-attack", [], null)).toBe("prepare-attack");
    expect(decideCategory("prepare-defence", [], null)).toBe("prepare-defence");
  });

  it("calls bait that punishes the capture a trap, and bait that can be taken a sacrifice", () => {
    expect(decideCategory("prepare-attack", [], "poisoned")).toBe("trap");
    expect(decideCategory("prepare-attack", [], "playable")).toBe("sacrifice");
  });

  it("lets the trained model override the rules", () => {
    expect(decideCategory("prepare-attack", ["sacrifice"], null)).toBe("sacrifice");
    expect(decideCategory("prepare-attack", ["attraction"], null)).toBe("trap");
    expect(decideCategory("prepare-defence", ["fork"], null)).toBe("attack");
  });

  it("keeps a direct attack as an attack, even if the model sees a luring idea", () => {
    expect(decideCategory("attack", ["attraction"], null)).toBe("attack");
    expect(decideCategory("attack", ["trappedPiece"], null)).toBe("attack");
  });

  it("ignores model labels that do not change the category", () => {
    const quiet: IdeaLabel[] = ["ordinary", "quietMove"];
    expect(decideCategory("prepare-attack", quiet, null)).toBe("prepare-attack");
  });
});

describe("buildCandidate", () => {
  it("describes an ordinary move", () => {
    const candidate = buildCandidate(START, line("g1", "f3", 25), [], null, null)!;
    expect(candidate).toMatchObject({
      san: "Nf3",
      title: "Knight to f3",
      category: "prepare-attack",
      reason: "From f3 your knight controls the centre squares d4 and e5.",
    });
    expect(candidate.squares.map((mark) => mark.square).sort()).toEqual(["d4", "e5"]);
  });

  it("puts captures and checks under attack", () => {
    const fen = "4k3/8/8/4n3/8/8/8/4RK2 w - - 0 1";
    expect(buildCandidate(fen, line("e1", "e5", 500), [], null, null)!.category).toBe("attack");
  });

  it("puts saving a piece under defend", () => {
    const fen = "4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1";
    expect(buildCandidate(fen, line("e5", "f3", 200), [], null, null)!.category).toBe("defend");
  });

  it("puts castling under prepare your defence", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    const candidate = buildCandidate(fen, line("e1", "g1", 20), [], null, null)!;
    expect(candidate).toMatchObject({ title: "Castling", category: "prepare-defence" });
  });

  it("words a trap and a sacrifice around the piece on offer", () => {
    const bait = { piece: "knight" as const, square: "e5" };
    const trap = buildCandidate(KNIGHT_AND_PAWN, line("f3", "e5", 300), [], bait, "poisoned")!;
    expect(trap.category).toBe("trap");
    expect(trap.reason).toBe(
      "It leaves your knight on e5 looking free, but taking it is a mistake for your opponent.",
    );

    const sacrifice = buildCandidate(KNIGHT_AND_PAWN, line("f3", "e5", 300), [], bait, "playable")!;
    expect(sacrifice.category).toBe("sacrifice");
    expect(sacrifice.reason).toBe("It gives up your knight on e5 to get something bigger in return.");
  });

  it("replaces the hint fallback with wording that suits a list", () => {
    const fen = "3qk3/8/8/8/8/8/8/3QK3 w - - 0 1";
    expect(buildCandidate(fen, line("e1", "f1", 0), [], null, null)!.reason).toBe(
      "A calm move that keeps your position solid.",
    );
  });

  it("returns null for an illegal move", () => {
    expect(buildCandidate(START, line("e2", "e5", 0), [], null, null)).toBeNull();
  });
});

describe("groupByCategory", () => {
  function candidate(title: string, category: Candidate["category"]): Candidate {
    return { move: { from: "a1", to: "a2" }, san: title, title, category, reason: "", ideas: [], squares: [], arrows: [] };
  }

  it("groups in the fixed category order and leaves out empty groups", () => {
    const groups = groupByCategory([
      candidate("Knight to f3", "prepare-attack"),
      candidate("Rook takes the knight on e5", "attack"),
      candidate("Castling", "prepare-defence"),
    ]);
    expect(groups.map((group) => group.label)).toEqual(["Attack", "Prepare an attack", "Prepare your defence"]);
  });

  it("orders moves alphabetically inside a group, so the best move is not given away", () => {
    const [group] = groupByCategory([
      candidate("Pawn to e4", "prepare-attack"),
      candidate("Knight to f3", "prepare-attack"),
      candidate("Bishop to c4", "prepare-attack"),
    ]);
    expect(group.candidates.map((item) => item.title)).toEqual(["Bishop to c4", "Knight to f3", "Pawn to e4"]);
  });

  it("has all six of the agreed categories", () => {
    expect(CATEGORIES.map((category) => category.id)).toEqual([
      "attack",
      "defend",
      "prepare-attack",
      "prepare-defence",
      "trap",
      "sacrifice",
    ]);
  });
});

describe("findCandidates", () => {
  /**
   * A fake engine. Asked for several lines it returns the root candidates;
   * asked for one line (the bait check) it returns `afterCapture`.
   */
  function engineWith(rootLines: EngineLine[], afterCapture = 0) {
    const requests: EngineRequest[] = [];
    const engine: ChessEngine = {
      analyse: async (request): Promise<EngineResult> => {
        requests.push(request);
        if ((request.lines ?? 1) > 1) return { bestMove: rootLines[0]?.move ?? null, lines: rootLines };
        const move = { from: "e1", to: "e2" };
        return { bestMove: move, lines: [{ move, pv: [move], scoreCp: afterCapture }] };
      },
      dispose: () => undefined,
    };
    return { engine, requests };
  }

  it("lists the sound moves and drops the bad ones", async () => {
    const { engine, requests } = engineWith([line("e2", "e4", 40), line("g1", "f3", 30), line("a2", "a3", -30)]);
    const candidates = await findCandidates(engine, null, START);

    expect(candidates.map((item) => item.san)).toEqual(["e4", "Nf3"]);
    expect(requests[0]).toMatchObject({ fen: START, lines: MAX_CANDIDATES, skillLevel: 20 });
    // No bait in these moves, so the engine was only asked once.
    expect(requests).toHaveLength(1);
  });

  it("calls a piece offer a trap when capturing it is a mistake", async () => {
    // Declining leaves white +300; taking the knight leaves white +600.
    const { engine } = engineWith([line("f3", "e5", 300)], 600);
    const [candidate] = await findCandidates(engine, null, KNIGHT_AND_PAWN);
    expect(candidate.category).toBe("trap");
  });

  it("calls the same offer a sacrifice when it can safely be taken", async () => {
    const { engine } = engineWith([line("f3", "e5", 300)], 310);
    const [candidate] = await findCandidates(engine, null, KNIGHT_AND_PAWN);
    expect(candidate.category).toBe("sacrifice");
  });

  it("uses the trained model's ideas when it has one", async () => {
    const { engine } = engineWith([line("e2", "e4", 40), line("g1", "f3", 30)]);
    const classifier: MoveClassifier = {
      classify: async () => [
        { ideas: [{ label: "ordinary", probability: 0.9 }], all: [] },
        { ideas: [{ label: "fork", probability: 0.9 }], all: [] },
      ],
    };
    const candidates = await findCandidates(engine, classifier, START);
    expect(candidates[0].ideas).toEqual([]);
    expect(candidates[1]).toMatchObject({ ideas: ["fork"], category: "attack" });
  });

  it("still works if the model fails", async () => {
    const { engine } = engineWith([line("e2", "e4", 40)]);
    const classifier: MoveClassifier = { classify: async () => Promise.reject(new Error("no model")) };
    const candidates = await findCandidates(engine, classifier, START);
    expect(candidates).toHaveLength(1);
  });

  it("returns nothing when the game is over", async () => {
    const { engine } = engineWith([]);
    expect(await findCandidates(engine, null, START)).toEqual([]);
  });
});
