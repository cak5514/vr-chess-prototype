import * as ort from "onnxruntime-web/wasm";
// "?url" asks Vite for the address of this file instead of its contents.
// Vite then serves it in development and copies it into the built site.
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { ENCODED_LENGTH, encodeMove, interpretLogits, NUM_PLANES } from "../core/index";
import type { ModelInfo, MoveChoice, MoveClassifier, MoveIdeas } from "../core/index";

// Runs the trained neural network in the browser.
//
// The model file (public/model/move_classifier.onnx) is produced by the
// Python code in training/. onnxruntime-web is the library that executes it.

const BASE = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE}model/move_classifier.onnx`;
const INFO_URL = `${BASE}model/move_classifier.json`;

// Tell the library where its WebAssembly file is, and to use a single thread.
// More threads would need special server settings that a simple static host
// does not have, and this model is small enough not to need them.
ort.env.wasm.wasmPaths = { wasm: wasmUrl };
ort.env.wasm.numThreads = 1;

interface Loaded {
  session: ort.InferenceSession;
  info: ModelInfo;
}

/** An answer with no ideas, used for a move that could not be encoded. */
const NOTHING: MoveIdeas = { ideas: [], all: [] };

/**
 * Creates the classifier. The model is only downloaded the first time it is
 * needed, so the page itself still opens quickly.
 */
export function createOnnxMoveClassifier(): MoveClassifier {
  let loading: Promise<Loaded> | null = null;

  async function load(): Promise<Loaded> {
    const [session, response] = await Promise.all([
      ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] }),
      fetch(INFO_URL),
    ]);
    if (!response.ok) throw new Error("The move classifier's settings could not be loaded.");
    return { session, info: (await response.json()) as ModelInfo };
  }

  return {
    async classify(fen: string, moves: MoveChoice[]): Promise<MoveIdeas[]> {
      if (moves.length === 0) return [];
      loading ??= load();
      const { session, info } = await loading;

      // All the moves go to the model together as one batch, which is much
      // faster than asking about them one at a time.
      const batch = new Float32Array(moves.length * ENCODED_LENGTH);
      const encodable = moves.map((move, i) => {
        const encoded = encodeMove(fen, move);
        if (encoded) batch.set(encoded, i * ENCODED_LENGTH);
        return encoded !== null;
      });

      const input = new ort.Tensor("float32", batch, [moves.length, NUM_PLANES, 8, 8]);
      const output = await session.run({ board: input });
      const logits = output.logits.data as Float32Array;
      const perMove = info.labels.length;

      return moves.map((_, i) =>
        encodable[i] ? interpretLogits(logits.subarray(i * perMove, (i + 1) * perMove), info) : NOTHING,
      );
    },
  };
}
