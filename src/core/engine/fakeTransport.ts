import type { UciTransport } from "./engine";

/**
 * A pretend engine for tests. It records what was sent and lets the test
 * decide what the "engine" prints back.
 */
export class FakeTransport implements UciTransport {
  sent: string[] = [];
  closed = false;
  private lineHandler: (line: string) => void = () => undefined;
  private errorHandler: (error: Error) => void = () => undefined;

  /** If set, called for every command so the test can auto-reply. */
  autoReply: ((command: string, transport: FakeTransport) => void) | null = null;

  send(command: string): void {
    this.sent.push(command);
    this.autoReply?.(command, this);
  }

  onLine(handler: (line: string) => void): void {
    this.lineHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  close(): void {
    this.closed = true;
  }

  /** Pretend the engine printed these lines. */
  print(...lines: string[]): void {
    for (const line of lines) this.lineHandler(line);
  }

  /** Pretend the engine crashed. */
  crash(message: string): void {
    this.errorHandler(new Error(message));
  }
}

/** A fake that completes the handshake and answers every search the same way. */
export function scriptedTransport(searchOutput: string[]): FakeTransport {
  const transport = new FakeTransport();
  transport.autoReply = (command, t) => {
    // Reply on the next tick, like a real engine in another thread.
    if (command === "uci") queueMicrotask(() => t.print("id name Fake", "uciok"));
    if (command === "isready") queueMicrotask(() => t.print("readyok"));
    if (command.startsWith("go")) queueMicrotask(() => t.print(...searchOutput));
  };
  return transport;
}
