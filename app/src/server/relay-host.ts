// Çaldır relay client helper (controlled side).
//
// Instead of binding a local WS server (which requires the controller to be on
// the same LAN), the controlled device opens a single outbound WebSocket
// connection to the public relay. The relay pairs this connection with the
// controller's connection using the 6-digit PIN and bridges the same
// `PlainFrame` traffic in both directions. The end-to-end Çaldır handshake +
// encryption is unchanged; the relay sees only opaque encrypted frames.

import {
  PairingManager,
  Session,
  type PlainFrame,
  type Platform,
} from "@caldir/shared";

export interface RelayHostOpts {
  pairing: PairingManager;
  platform: Platform;
  relayUrl: string; // e.g. wss://relay-caldir.onrender.com
}

export interface RelayStartResult {
  pin: string;
  relayUrl: string;
}

export class RelayHost {
  private pairing: PairingManager;
  private platform: Platform;
  private relayUrl: string;
  private ws: WebSocket | null = null;
  private session: Session | null = null;

  constructor(opts: RelayHostOpts) {
    this.pairing = opts.pairing;
    this.platform = opts.platform;
    this.relayUrl = opts.relayUrl;
  }

  async start(): Promise<RelayStartResult> {
    const pin = this.pairing.beginPairing();
    const url = `${this.relayUrl}/?pin=${pin}&role=host`;
    await this.connect(url);
    return { pin, relayUrl: this.relayUrl };
  }

  private connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let opened = false;
      try {
        this.ws = new WebSocket(url, "caldir-relay.v1");
      } catch (e) {
        reject(e);
        return;
      }
      this.ws.binaryType = "arraybuffer";
      const ws2 = this.ws;
      ws2.onopen = () => {
        opened = true;
        this.session = new Session({
          id: "relay-host",
          platform: this.platform,
          pairing: this.pairing,
          send: (frame: PlainFrame) => {
            if (ws2 && ws2.readyState === WebSocket.OPEN) {
              ws2.send(JSON.stringify(frame));
            }
          },
        });
        ws2.onmessage = (ev) => {
          if (typeof ev.data !== "string") return;
          let frame: PlainFrame;
          try { frame = JSON.parse(ev.data) as PlainFrame; } catch { return; }
          this.session?.handleFrame(frame).catch(() => { /* ignore */ });
        };
        ws2.onclose = () => { this.ws = null; };
        ws2.onerror = () => { if (!opened) reject(new Error("relay_connect_failed")); };
        resolve();
      };
      this.ws.onerror = () => { if (!opened) reject(new Error("relay_connect_failed")); };
    });
  }

  async stop(): Promise<void> {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.session = null;
  }
}
