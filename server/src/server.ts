import { WebSocketServer, type WebSocket } from "ws";
import {
  type PairingManager,
  type Platform,
  type PlainFrame,
  Session,
} from "@caldir/shared";

export interface ServerOptions {
  host: string;
  port: number;
  platform: Platform;
  pairing: PairingManager;
}

const MAX_FRAMES_PER_WINDOW = 20;
const WINDOW_MS = 5000;

// Boot a Node WebSocket server that drives shared.Session per connection.
export function startSecureServer(opts: ServerOptions): { close: () => void; port: number } {
  const wss = new WebSocketServer({
    host: opts.host,
    port: opts.port,
    handleProtocols: (protocols: Set<string>): string | false =>
      protocols.has("caldir.v1") ? "caldir.v1" : false,
    maxPayload: 4 * 1024 * 1024,
  });

  wss.on("connection", (ws: WebSocket) => {
    const id = Math.random().toString(36).slice(2, 10);
    const session = new Session({
      id,
      platform: opts.platform,
      pairing: opts.pairing,
      send: (frame: PlainFrame) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
      },
    });

    let frameCount = 0;
    let windowStart = Date.now();

    ws.on("message", (data, isBinary) => {
      if (isBinary) { ws.close(1003, "binary_not_allowed"); return; }
      const now = Date.now();
      if (now - windowStart > WINDOW_MS) { windowStart = now; frameCount = 0; }
      frameCount += 1;
      if (frameCount > MAX_FRAMES_PER_WINDOW) { ws.close(1008, "rate_limit"); return; }
      let frame: PlainFrame;
      try { frame = JSON.parse(data.toString()) as PlainFrame; } catch { ws.close(1003, "invalid_json"); return; }
      session.handleFrame(frame).catch((e) => {
        const message = e instanceof Error ? e.message : "internal";
        try { ws.send(JSON.stringify({ type: "error", code: "internal", message })); } catch { /* ignore */ }
      });
    });

    ws.on("error", () => { /* swallow; don't crash process */ });
  });

  return { close: () => wss.close(), port: opts.port };
}
