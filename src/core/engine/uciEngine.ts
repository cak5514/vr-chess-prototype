import type { MoveChoice } from "../types";
import type { ChessEngine, EngineLine, EngineRequest, EngineResult, UciTransport } from "./engine";
import { parseBestMove, parseInfo } from "./uci";
import type { InfoLine } from "./uci";

/** A conversation step: commands we send, and how we know the reply is complete. */
interface Step {
  isDone(line: string): boolean;
  resolve(): void;
  reject(error: Error): void;
}

/**
 * Drives any UCI engine through a text channel.
 *
 * UCI is a simple conversation: we send a command, the engine prints lines,
 * and a known line ("uciok", "readyok", "bestmove ...") marks the end.
 * Searches are queued so only one runs at a time.
 */
export class UciEngine implements ChessEngine {
  private currentStep: Step | null = null;
  private onLineExtra: ((line: string) => void) | null = null;
  private failure: Error | null = null;
  private ready: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private transport: UciTransport) {
    transport.onLine((line) => this.handleLine(line));
    transport.onError((error) => this.fail(error));

    // The standard handshake: introduce ourselves, then wait until it is ready.
    this.ready = this.talk(["uci"], (line) => line === "uciok").then(() =>
      this.talk(["isready"], (line) => line === "readyok"),
    );
    // Stops Node/browsers reporting the error twice; analyse() reports it.
    this.ready.catch(() => undefined);
  }

  analyse(request: EngineRequest): Promise<EngineResult> {
    const job = this.queue.then(() => this.search(request));
    this.queue = job.catch(() => undefined);
    return job;
  }

  dispose(): void {
    this.transport.send("quit");
    this.transport.close();
    this.fail(new Error("The engine was shut down."));
  }

  private async search(request: EngineRequest): Promise<EngineResult> {
    await this.ready;

    // The engine reports each candidate several times as it searches deeper.
    // We keep the latest report for each rank.
    const latest = new Map<number, InfoLine>();
    let bestMove: MoveChoice | null = null;

    this.onLineExtra = (line) => {
      const info = parseInfo(line);
      if (info) latest.set(info.rank, info);
      const best = parseBestMove(line);
      if (best !== undefined) bestMove = best;
    };

    try {
      await this.talk(
        [
          `setoption name Skill Level value ${request.skillLevel ?? 20}`,
          `setoption name MultiPV value ${request.lines ?? 1}`,
          `position fen ${request.fen}`,
          `go depth ${request.depth}`,
        ],
        (line) => line.startsWith("bestmove"),
      );
    } finally {
      this.onLineExtra = null;
    }

    const lines: EngineLine[] = [...latest.values()]
      .sort((a, b) => a.rank - b.rank)
      .map(({ move, pv, scoreCp, mateIn }) => ({ move, pv, scoreCp, mateIn }));
    return { bestMove, lines };
  }

  /** Sends commands and waits for the line that ends the reply. */
  private talk(commands: string[], isDone: (line: string) => boolean): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.currentStep = { isDone, resolve, reject };
      for (const command of commands) this.transport.send(command);
    });
  }

  private handleLine(line: string): void {
    this.onLineExtra?.(line);
    const step = this.currentStep;
    if (step?.isDone(line)) {
      this.currentStep = null;
      step.resolve();
    }
  }

  private fail(error: Error): void {
    this.failure ??= error;
    this.currentStep?.reject(this.failure);
    this.currentStep = null;
  }
}
