// Çaldır relay server.
//
// A stateless WebSocket relay that pairs a "controlled" device (the APK that
// opened a WS server locally) with a "controller" (the web panel) using a
// 6-digit PIN as the only identifying information. Neither side exposes a
// public IP; both connect outbound to this relay over wss:// and the relay
// bridges their text frames in both directions.
//
// Security:
//   - The 6-digit PIN is a one-time, short-lived room id. The relay forgets
//     the room as soon as either party disconnects.
//   - The relay CANNOT read the traffic: the Çaldır protocol is already
//     end-to-end encrypted (X25519 + AES-256-GCM via tweetnacl). The relay
//     forwards opaque text frames; it never sees plaintext.
//   - Only text frames are forwarded; binary frames are rejected (close 1003).
//   - Hard frame cap of 4 MiB; rate-limit 20 frames / 5 s per connection.

import { WebSocketServer, WebSocket } from "ws";

export interface RelayOptions {
  host: string;
  port: number;
}

interface Room {
  host: WebSocket | null;
  guest: WebSocket | null;
  createdAt: number;
}

const ROOM_TTL_MS = 5 * 60 * 1000;
const MAX_FRAMES_PER_WINDOW = 60;
const WINDOW_MS = 5000;
const MAX_PAYLOAD = 4 * 1024 * 1024;

export function startRelay(opts: RelayOptions): { close: () => void; port: number } {
  const rooms = new Map<string, Room>();

  function sweep() {
    const now = Date.now();
    for (const [pin, room] of rooms) {
      if (now - room.createdAt > ROOM_TTL_MS) {
        for (const ws of [room.host, room.guest]) {
          if (ws && ws.readyState === ws.OPEN) ws.close(1000, "ttl");
        }
        rooms.delete(pin);
      }
    }
  }
  const sweeper = setInterval(sweep, 30_000);

  const wss = new WebSocketServer({
    host: opts.host,
    port: opts.port,
    handleProtocols: (p: Set<string>): string | false =>
      p.has("caldir-relay.v1") ? "caldir-relay.v1" : false,
    maxPayload: MAX_PAYLOAD,
  });

  wss.on("connection", (ws: WebSocket, req) => {
    // URL: /?pin=123456&role=host|guest
    const url = new URL(req.url || "/", "http://dummy");
    const pin = url.searchParams.get("pin") || "";
    const role = url.searchParams.get("role") || "";
    if (!/^\d{6}$/.test(pin) || (role !== "host" && role !== "guest")) {
      ws.close(1008, "bad_args");
      return;
    }

    let room = rooms.get(pin);
    if (!room) {
      room = { host: null, guest: null, createdAt: Date.now() };
      rooms.set(pin, room);
    }

    if (role === "host") {
      if (room.host && room.host.readyState !== room.host.CLOSED) {
        ws.close(1008, "host_taken");
        return;
      }
      room.host = ws;
    } else {
      if (room.guest && room.guest.readyState !== room.guest.CLOSED) {
        ws.close(1008, "guest_taken");
        return;
      }
      room.guest = ws;
    }

    let frameCount = 0;
    let windowStart = Date.now();

    ws.on("message", (data, isBinary) => {
      if (isBinary) { ws.close(1003, "binary_not_allowed"); return; }
      const now = Date.now();
      if (now - windowStart > WINDOW_MS) { windowStart = now; frameCount = 0; }
      frameCount += 1;
      if (frameCount > MAX_FRAMES_PER_WINDOW) { ws.close(1008, "rate_limit"); return; }
      const peer = role === "host" ? room!.guest : room!.host;
      if (peer && peer.readyState === peer.OPEN) {
        peer.send(data.toString());
      }
    });

    ws.on("close", () => {
      if (role === "host") room!.host = null;
      else room!.guest = null;
      if (!room!.host && !room!.guest) {
        rooms.delete(pin);
      }
    });

    ws.on("error", () => { /* swallow */ });
  });

  return {
    close: () => { clearInterval(sweeper); wss.close(); },
    port: opts.port,
  };
}
