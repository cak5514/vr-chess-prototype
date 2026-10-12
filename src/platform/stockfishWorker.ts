import type { UciTransport } from "../core/index";

// The engine files live in public/stockfish/ and are served as they are.
// BASE_URL keeps the path right when the site is hosted in a sub-folder.
const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`;

/**
 * Starts Stockfish in a Web Worker, which is a background thread. The engine
 * can think there without freezing the page. We talk to it with text
 * messages, which is all the UCI protocol needs.
 */
export function createStockfishTransport(): UciTransport {
  const worker = new Worker(ENGINE_URL);
  let lineHandler: (line: string) => void = () => undefined;
  let errorHandler: (error: Error) => void = () => undefined;

  worker.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== "string") return;
    for (const line of event.data.split("\n")) lineHandler(line.trim());
  };
  worker.onerror = (event: ErrorEvent) => {
    errorHandler(new Error(event.message || "The chess engine failed to load."));
  };

  return {
    send: (command) => worker.postMessage(command),
    onLine: (handler) => {
      lineHandler = handler;
    },
    onError: (handler) => {
      errorHandler = handler;
    },
    close: () => worker.terminate(),
  };
}
